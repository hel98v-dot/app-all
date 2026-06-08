// src/contexts/DriveSync.tsx
// Sincronizzazione automatica via GitHub Gist — SOLO i log di allenamento.
//
// Scelta deliberata: si sincronizza esclusivamente il LogStore (le sessioni),
// NON le schede. Sincronizzare anche le schede causava un loop di ricarica
// (unione delle liste schede che differiva sempre dal locale). Le schede si
// trasferiscono tra dispositivi con Esporta/Importa backup (manuale, una volta).
//
// Flusso:
//  1. Avvio / ritorno in foreground: pull → merge (granulare per esercizio) →
//     se il log è davvero cambiato, applica e ricarica UNA volta (guardia anti-loop).
//  2. Ad ogni modifica del log: push debounced (merge remoto+locale, nessun reload).

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import {
  isConnected, saveToken, removeToken,
  readFromGist, writeToGist, verifyToken,
} from '../lib/gistsync';
import type { LogStore, SessionLog, ExerciseLog } from '../types';
import { logKey } from '../hooks/useProfileStore';

// ── Merge granulare di due LogStore (per esercizio) ───────────────────────────

const DAY_PREFIX: Record<string, string> = {
  lunedi: 'lun', martedi: 'mar', mercoledi: 'mer',
  giovedi: 'gio', venerdi: 'ven', sabato: 'sab', domenica: 'dom',
};
function canonId(id: string): string {
  for (const [full, short] of Object.entries(DAY_PREFIX)) {
    if (id.startsWith(full + '-')) return short + id.slice(full.length);
  }
  return id;
}

function exDoneSets(e: ExerciseLog): number { return e.sets.filter(s => s.reps > 0).length; }
function exReps(e: ExerciseLog): number { return e.sets.reduce((a, s) => a + s.reps, 0); }

function mergeExercises(a: ExerciseLog[], b: ExerciseLog[]): ExerciseLog[] {
  const map = new Map<string, ExerciseLog>();
  for (const ex of [...a, ...b]) {
    const key = canonId(ex.exerciseId);
    const existing = map.get(key);
    if (!existing) { map.set(key, ex); continue; }
    const eDone = exDoneSets(ex), xDone = exDoneSets(existing);
    if (eDone > xDone) map.set(key, ex);
    else if (eDone === xDone && exReps(ex) > exReps(existing)) map.set(key, ex);
    else if (eDone === xDone && exReps(ex) === exReps(existing) && ex.completedAt > existing.completedAt) map.set(key, ex);
  }
  return Array.from(map.values());
}

export function mergeStores(local: LogStore, remote: LogStore): LogStore {
  const startDate = local.startDate <= remote.startDate ? local.startDate : remote.startDate;
  const map = new Map<string, SessionLog>();
  for (const s of [...local.sessions, ...remote.sessions]) {
    const key = `${s.weekNumber}::${s.sessionId}::${s.date}`;
    const existing = map.get(key);
    if (!existing) map.set(key, s);
    else map.set(key, { ...existing, exercises: mergeExercises(existing.exercises, s.exercises) });
  }
  return { startDate, sessions: Array.from(map.values()) };
}

// ── Estrai un LogStore dal contenuto del Gist (bundle o log "nudo") ───────────

function extractLog(raw: unknown): LogStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { sessions?: unknown; log?: { sessions?: unknown } };
  if (Array.isArray(o.sessions)) return o as unknown as LogStore;          // LogStore nudo
  if (o.log && Array.isArray(o.log.sessions)) return o.log as LogStore;    // bundle
  return null;
}

// ── Chiave log del profilo attivo ─────────────────────────────────────────────

function activeLogKey(): string {
  try {
    const raw = localStorage.getItem('profiles-v1');
    if (raw) {
      const p = JSON.parse(raw) as { activeId?: string };
      if (p.activeId) return logKey(p.activeId);
    }
  } catch { /* ignore */ }
  return 'training-log-v1';
}
const LOG_KEY = activeLogKey();

function readLocal(): LogStore | null {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as LogStore) : null;
  } catch { return null; }
}
function writeLocal(store: LogStore): void {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

// ── Guardia anti-loop: al massimo una ricarica da sync ogni 20 s ──────────────

function reloadAllowed(): boolean {
  try {
    const k = 'arise-sync-reload-at';
    const last = Number(sessionStorage.getItem(k) || '0');
    if (Date.now() - last < 20_000) return false;
    sessionStorage.setItem(k, String(Date.now()));
    return true;
  } catch { return true; }
}

// ── Tipi ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'disconnected' | 'idle' | 'syncing' | 'synced' | 'error';

export interface DriveSyncCtx {
  status:       SyncStatus;
  username:     string | null;
  lastSync:     Date | null;
  error:        string | null;
  isConnected:  boolean;
  connect:      (token: string) => Promise<void>;
  disconnect:   () => void;
  manualSync:   () => Promise<void>;
}

const Ctx = createContext<DriveSyncCtx | null>(null);

export function useDriveSync(): DriveSyncCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriveSync: DriveSyncProvider mancante');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3000;
const USERNAME_KEY = 'gist-username-v1';

export function DriveSyncProvider({ children }: { children: ReactNode }) {
  const [status,   setStatus]   = useState<SyncStatus>(() => isConnected() ? 'idle' : 'disconnected');
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY));
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive     = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // ── Pull + merge (log soltanto) ───────────────────────────────────────────

  const pullAndMerge = useCallback(async (): Promise<void> => {
    if (!alive.current) return;
    setStatus('syncing');
    setError(null);
    try {
      const remoteJson = await readFromGist();
      if (!alive.current) return;

      const local = readLocal() ?? { startDate: new Date().toISOString().slice(0, 10), sessions: [] };

      if (remoteJson) {
        let remoteRaw: unknown = null;
        try { remoteRaw = JSON.parse(remoteJson); } catch { /* ignore */ }
        const remoteLog = extractLog(remoteRaw);

        if (remoteLog) {
          const merged = mergeStores(local, remoteLog);
          const mJson = JSON.stringify(merged);

          // Aggiorna il Gist (log nudo) se il merge differisce dal remoto.
          if (mJson !== JSON.stringify(remoteLog)) await writeToGist(mJson);

          // Applica in locale + ricarica SOLO se il log locale è cambiato,
          // e non più di una volta ogni 20 s (guardia anti-loop).
          if (mJson !== JSON.stringify(local)) {
            writeLocal(merged);
            const isLogging = window.location.pathname.includes('/esercizio/')
                           || window.location.pathname.includes('/superset/');
            if (!isLogging && reloadAllowed()) { window.location.reload(); return; }
          }
        } else if (local.sessions.length > 0) {
          // Remoto non interpretabile: sovrascrivi col locale (se ha dati).
          await writeToGist(JSON.stringify(local));
        }
      } else if (local.sessions.length > 0) {
        await writeToGist(JSON.stringify(local));
      }

      if (alive.current) { setStatus('synced'); setLastSync(new Date()); }
    } catch (e) {
      if (alive.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Errore sincronizzazione');
      }
    }
  }, []);

  // ── Push (merge remoto+locale, nessun reload, mai store vuoto) ─────────────

  const doPush = useCallback(async (): Promise<void> => {
    if (!isConnected() || !alive.current) return;
    const local = readLocal();
    if (!local || local.sessions.length === 0) return;
    setStatus('syncing');
    try {
      let remoteRaw: unknown = null;
      const remoteJson = await readFromGist();
      if (remoteJson) { try { remoteRaw = JSON.parse(remoteJson); } catch { /* ignore */ } }
      const remoteLog = extractLog(remoteRaw);
      const merged = remoteLog ? mergeStores(local, remoteLog) : local;
      await writeToGist(JSON.stringify(merged));
      if (alive.current) { setStatus('synced'); setLastSync(new Date()); }
    } catch (e) {
      if (alive.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Errore push Gist');
      }
    }
  }, []);

  // ── Auto-push su modifiche del log ────────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      if (!isConnected()) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(doPush, DEBOUNCE_MS);
    };
    window.addEventListener('log-store-update', handler);
    return () => {
      window.removeEventListener('log-store-update', handler);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [doPush]);

  // ── Pull all'avvio se connesso ────────────────────────────────────────────

  useEffect(() => {
    if (isConnected()) pullAndMerge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pull al ritorno in foreground ─────────────────────────────────────────

  useEffect(() => {
    const onVisible = () => { if (!document.hidden && isConnected()) pullAndMerge(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [pullAndMerge]);

  // ── Azioni pubbliche ──────────────────────────────────────────────────────

  const connect = useCallback(async (token: string) => {
    setStatus('syncing');
    setError(null);
    try {
      saveToken(token);
      const user = await verifyToken();
      localStorage.setItem(USERNAME_KEY, user);
      if (alive.current) setUsername(user);
      await pullAndMerge();
    } catch (e) {
      removeToken();
      if (alive.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Token non valido');
      }
    }
  }, [pullAndMerge]);

  const disconnect = useCallback(() => {
    removeToken();
    localStorage.removeItem(USERNAME_KEY);
    setStatus('disconnected');
    setUsername(null);
    setLastSync(null);
    setError(null);
  }, []);

  const manualSync = useCallback(() => pullAndMerge(), [pullAndMerge]);

  return (
    <Ctx.Provider value={{
      status, username, lastSync, error,
      isConnected: isConnected(),
      connect, disconnect, manualSync,
    }}>
      {children}
    </Ctx.Provider>
  );
}
