// src/contexts/DriveSync.tsx
// Contesto React che gestisce la sincronizzazione automatica con Google Drive.
//
// Flusso:
//  1. All'avvio: se connesso, legge da Drive, fa il merge con il locale,
//     salva il merged localmente e ricarica l'app (una volta sola).
//  2. Ad ogni mutazione del log (evento 'log-store-update' da useLogStore),
//     fa un push debounced (3 s) verso Drive.
//  3. Impostazioni: connect / disconnect / sync manuale.

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import {
  isConnected, signIn, signOut, readFromDrive, writeToDrive,
  getConnectedEmail, loadClientId, saveClientId as persistClientId,
} from '../lib/gdrive';
import type { LogStore, SessionLog } from '../types';
import { logKey } from '../hooks/useProfileStore';

// ── Merge di due LogStore ─────────────────────────────────────────────────────
// Strategia: unione delle sessioni (per chiave settimana+sessionId+data).
// In caso di duplicato, vince la sessione con il maggior volume di reps
// (=più dati inseriti). La startDate è la più antica tra le due.

function sessionReps(s: SessionLog): number {
  return s.exercises.reduce(
    (a, e) => a + e.sets.reduce((b, set) => b + set.reps, 0),
    0,
  );
}

export function mergeStores(local: LogStore, remote: LogStore): LogStore {
  const startDate = local.startDate <= remote.startDate
    ? local.startDate
    : remote.startDate;

  const map = new Map<string, SessionLog>();
  for (const s of [...local.sessions, ...remote.sessions]) {
    const key = `${s.weekNumber}::${s.sessionId}::${s.date}`;
    const existing = map.get(key);
    if (!existing || sessionReps(s) > sessionReps(existing)) {
      map.set(key, s);
    }
  }
  return { startDate, sessions: Array.from(map.values()) };
}

// ── Chiave localStorage del profilo attivo ────────────────────────────────────
// La calcoliamo all'avvio del modulo (il profilo non cambia a runtime).

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
  status:      SyncStatus;
  email:       string | null;
  lastSync:    Date | null;
  error:       string | null;
  clientId:    string | null;
  setClientId: (id: string) => void;
  connect:     () => Promise<void>;
  disconnect:  () => void;
  manualSync:  () => Promise<void>;
}

const Ctx = createContext<DriveSyncCtx | null>(null);

export function useDriveSync(): DriveSyncCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriveSync: DriveSyncProvider mancante nell\'albero');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3000;

export function DriveSyncProvider({ children }: { children: ReactNode }) {
  const [status,   setStatus]   = useState<SyncStatus>(() => isConnected() ? 'idle' : 'disconnected');
  const [email,    setEmail]    = useState<string | null>(getConnectedEmail);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [clientId, setClientIdState] = useState<string | null>(loadClientId);

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive     = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // ── Salva Client ID ───────────────────────────────────────────────────────

  const setClientId = useCallback((id: string) => {
    persistClientId(id);
    setClientIdState(id.trim() || null);
  }, []);

  // ── Pull + merge ──────────────────────────────────────────────────────────

  const pullAndMerge = useCallback(async (): Promise<void> => {
    if (!alive.current) return;
    setStatus('syncing');
    setError(null);
    try {
      const remoteJson = await readFromDrive();
      if (!alive.current) return;

      if (remoteJson) {
        const remote   = JSON.parse(remoteJson) as LogStore;
        const local    = readLocal();
        const merged   = local ? mergeStores(local, remote) : remote;
        const mJson    = JSON.stringify(merged);

        // Scrivi su Drive il merged (così entrambi i dispositivi convergono)
        await writeToDrive(mJson);

        // Aggiorna localStorage e ricarica SOLO se ci sono differenze
        const lJson = local ? JSON.stringify(local) : null;
        if (mJson !== lJson) {
          writeLocal(merged);
          // Non ricaricare se si sta loggando (evita perdita dati)
          const isLogging = window.location.pathname.includes('/esercizio/')
                         || window.location.pathname.includes('/superset/');
          if (!isLogging) {
            window.location.reload();
            return; // il reload resetta questo componente
          }
        }
      } else {
        // Nessun file su Drive → carica quello locale (primo accesso da questo device)
        const local = readLocal();
        if (local) await writeToDrive(JSON.stringify(local));
      }

      if (alive.current) { setStatus('synced'); setLastSync(new Date()); }
    } catch (e) {
      if (alive.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Errore sincronizzazione');
      }
    }
  }, []);

  // ── Push (solo scrittura, senza pull) ─────────────────────────────────────

  const doPush = useCallback(async (): Promise<void> => {
    if (!isConnected() || !alive.current) return;
    setStatus('syncing');
    try {
      const local = readLocal();
      if (local) await writeToDrive(JSON.stringify(local));
      if (alive.current) { setStatus('synced'); setLastSync(new Date()); }
    } catch (e) {
      if (alive.current) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Errore push Drive');
      }
    }
  }, []);

  // ── Auto-push su modifiche del log ────────────────────────────────────────
  // useLogStore dispatcha 'log-store-update' dopo ogni commit.

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

  // ── Azioni pubbliche ──────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setStatus('syncing');
    setError(null);
    try {
      await signIn();
      if (alive.current) setEmail(getConnectedEmail());
      await pullAndMerge();
    } catch (e) {
      if (alive.current) {
        setStatus(isConnected() ? 'idle' : 'error');
        setError(e instanceof Error ? e.message : 'Errore di connessione');
      }
    }
  }, [pullAndMerge]);

  const disconnect = useCallback(() => {
    signOut();
    setStatus('disconnected');
    setEmail(null);
    setLastSync(null);
    setError(null);
  }, []);

  const manualSync = useCallback(() => pullAndMerge(), [pullAndMerge]);

  return (
    <Ctx.Provider value={{
      status, email, lastSync, error, clientId, setClientId,
      connect, disconnect, manualSync,
    }}>
      {children}
    </Ctx.Provider>
  );
}
