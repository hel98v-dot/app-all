// src/contexts/DriveSync.tsx
// Contesto React per la sincronizzazione automatica via GitHub Gist.
//
// Flusso:
//  1. All'avvio: se connesso, legge dal Gist, fa merge con locale,
//     salva il merged localmente + sul Gist e ricarica l'app se ci sono diff.
//  2. Ad ogni mutazione del log (evento 'log-store-update' da useLogStore),
//     fa un push debounced (3 s) verso il Gist.
//  3. Settings: inserisci token / disconnetti / sync manuale.

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

// ── Merge di due LogStore ─────────────────────────────────────────────────────
// Strategia granulare (esercizio per esercizio):
//   • Sessioni: unione per (weekNumber, sessionId, date).
//   • Esercizi dentro ogni sessione: unione per exerciseId normalizzato.
//     Per ogni esercizio duplicato, vince quello con più reps (più completo).
//   • startDate: la più antica tra le due.
//
// Questo evita di perdere esercizi quando i due dispositivi hanno versioni
// parziali della stessa sessione (es. telefono ha A,B,C e PC ha A,B,D
// → merge produce A,B,C,D).

/** Normalizza 'giovedi-0' → 'gio-0' per confronto cross-formato. */
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

function exDoneSets(e: ExerciseLog): number {
  return e.sets.filter(s => s.reps > 0).length;
}
function exReps(e: ExerciseLog): number {
  return e.sets.reduce((a, s) => a + s.reps, 0);
}

function mergeExercises(a: ExerciseLog[], b: ExerciseLog[]): ExerciseLog[] {
  const map = new Map<string, ExerciseLog>();
  for (const ex of [...a, ...b]) {
    const key = canonId(ex.exerciseId);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, ex);
      continue;
    }
    // Priorità: 1) più serie completate (reps > 0)
    //           2) più reps totali
    //           3) più recente (completedAt)
    const eDone = exDoneSets(ex);
    const xDone = exDoneSets(existing);
    if (eDone > xDone) {
      map.set(key, ex);
    } else if (eDone === xDone && exReps(ex) > exReps(existing)) {
      map.set(key, ex);
    } else if (eDone === xDone && exReps(ex) === exReps(existing)
               && ex.completedAt > existing.completedAt) {
      map.set(key, ex);
    }
  }
  return Array.from(map.values());
}

export function mergeStores(local: LogStore, remote: LogStore): LogStore {
  const startDate = local.startDate <= remote.startDate
    ? local.startDate
    : remote.startDate;

  const map = new Map<string, SessionLog>();

  for (const s of [...local.sessions, ...remote.sessions]) {
    const key = `${s.weekNumber}::${s.sessionId}::${s.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      // Merge a livello di esercizio: unione, non sostituzione
      map.set(key, {
        ...existing,
        exercises: mergeExercises(existing.exercises, s.exercises),
      });
    }
  }

  return { startDate, sessions: Array.from(map.values()) };
}

// ── Chiave localStorage del profilo attivo ────────────────────────────────────

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

// ── Tipi ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'disconnected' | 'idle' | 'syncing' | 'synced' | 'error';

export interface DriveSyncCtx {
  status:       SyncStatus;
  username:     string | null;   // username GitHub dell'account connesso
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

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // ── Pull + merge ──────────────────────────────────────────────────────────

  const pullAndMerge = useCallback(async (): Promise<void> => {
    if (!alive.current) return;
    setStatus('syncing');
    setError(null);
    try {
      const remoteJson = await readFromGist();
      if (!alive.current) return;

      if (remoteJson) {
        const remote = JSON.parse(remoteJson) as LogStore;
        const local  = readLocal();
        const merged = local ? mergeStores(local, remote) : remote;
        const mJson  = JSON.stringify(merged);

        await writeToGist(mJson);

        const lJson = local ? JSON.stringify(local) : null;
        if (mJson !== lJson) {
          writeLocal(merged);
          const isLogging = window.location.pathname.includes('/esercizio/')
                         || window.location.pathname.includes('/superset/');
          if (!isLogging) { window.location.reload(); return; }
        }
      } else {
        // Primo accesso da questo device: carica il locale sul Gist
        const local = readLocal();
        if (local) await writeToGist(JSON.stringify(local));
      }

      if (alive.current) { setStatus('synced'); setLastSync(new Date()); }
    } catch (e) {
      if (alive.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Errore sincronizzazione');
      }
    }
  }, []);

  // ── Push ──────────────────────────────────────────────────────────────────

  const doPush = useCallback(async (): Promise<void> => {
    if (!isConnected() || !alive.current) return;
    setStatus('syncing');
    try {
      const local = readLocal();
      if (local) await writeToGist(JSON.stringify(local));
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

  // ── Pull all'avvio se già connesso ────────────────────────────────────────

  useEffect(() => {
    if (isConnected()) pullAndMerge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pull quando l'app torna in foreground ─────────────────────────────────
  // Cattura sia il ritorno dalla schermata Home (PWA mobile) sia il cambio
  // di tab su browser desktop → garantisce che il PC veda i dati del telefono
  // non appena l'utente riaprirà la scheda.

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && isConnected()) pullAndMerge();
    };
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
