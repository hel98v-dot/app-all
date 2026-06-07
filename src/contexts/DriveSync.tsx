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
import {
  buildBackup, applyBackup, isBackupBundle, type AppBackup,
} from '../lib/backup';
import {
  DEFAULT_SCHEDULE_ID, type SchedulesStore, type StoredSchedule,
} from '../lib/schedules';
import { today } from '../lib/dates';

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

// ── Merge dell'intero bundle (log + schede + superset + swap) ─────────────────
// Il payload sincronizzato è il backup completo, non solo i log: così un
// dispositivo che non ha mai importato la scheda Excel riceve comunque la
// definizione della scheda e può mostrare i log sincronizzati.

function asLogStore(v: unknown): LogStore | null {
  if (v && typeof v === 'object' && Array.isArray((v as { sessions?: unknown }).sessions)) {
    return v as LogStore;
  }
  return null;
}

function asSchedulesStore(v: unknown): SchedulesStore | null {
  if (v && typeof v === 'object' && Array.isArray((v as { list?: unknown }).list)) {
    return v as SchedulesStore;
  }
  return null;
}

function exerciseTotal(s: StoredSchedule): number {
  return s.sessions.reduce((a, sess) => a + sess.exercises.length, 0);
}

/** scheduleId che possiede più serie loggate (reps > 0), o null. */
function ownerScheduleId(log: LogStore): string | null {
  const tally = new Map<string, number>();
  for (const s of log.sessions) {
    const sid = s.scheduleId ?? DEFAULT_SCHEDULE_ID;
    const n = s.exercises.reduce((a, e) => a + e.sets.filter(x => x.reps > 0).length, 0);
    if (n > 0) tally.set(sid, (tally.get(sid) ?? 0) + n);
  }
  let best: string | null = null, bestN = 0;
  for (const [sid, n] of tally) if (n > bestN) { best = sid; bestN = n; }
  return best;
}

/** Unione delle schede per id (preferendo la versione più completa). */
function mergeSchedulesStore(
  local: SchedulesStore | null,
  remote: SchedulesStore | null,
  mergedLog: LogStore,
): SchedulesStore | null {
  if (!local && !remote) return null;
  const byId = new Map<string, StoredSchedule>();
  // remote prima, local dopo → a parità vince il local (nomi locali)
  for (const s of [...(remote?.list ?? []), ...(local?.list ?? [])]) {
    const existing = byId.get(s.id);
    if (!existing || exerciseTotal(s) > exerciseTotal(existing)) byId.set(s.id, s);
  }
  const list = Array.from(byId.values());

  // activeId: la scheda che possiede più dati (se valida), poi l'active locale,
  // poi la prima, poi default.
  const owner = ownerScheduleId(mergedLog);
  const valid = (id: string | null | undefined): id is string =>
    !!id && (id === DEFAULT_SCHEDULE_ID || list.some(s => s.id === id));
  const activeId = valid(owner) ? owner
    : valid(local?.activeId) ? local!.activeId
    : (list[0]?.id ?? DEFAULT_SCHEDULE_ID);

  return { activeId, list };
}

/** Unione superficiale di due mappe (key→value). A parità vince il local. */
function mergeKeyMaps(local: unknown, remote: unknown): unknown {
  if (!local && !remote) return null;
  const out: Record<string, unknown> = {};
  if (remote && typeof remote === 'object') Object.assign(out, remote);
  if (local  && typeof local  === 'object') Object.assign(out, local);
  return out;
}

/** Merge di due bundle. `remoteRaw` può essere un bundle o un LogStore "nudo". */
function mergeBundles(local: AppBackup, remoteRaw: unknown): AppBackup {
  let remote: Partial<AppBackup> = {};
  if (isBackupBundle(remoteRaw)) remote = remoteRaw as AppBackup;
  else if (asLogStore(remoteRaw)) remote = { log: remoteRaw };

  const localLog  = asLogStore(local.log) ?? { startDate: today(), sessions: [] };
  const remoteLog = asLogStore(remote.log);
  const mergedLog = remoteLog ? mergeStores(localLog, remoteLog) : localLog;

  return {
    version:    2,
    exportedAt: new Date().toISOString(),
    profileId:  local.profileId,
    log:        mergedLog,
    schedules:  mergeSchedulesStore(asSchedulesStore(local.schedules), asSchedulesStore(remote.schedules), mergedLog),
    supersets:  mergeKeyMaps(local.supersets, remote.supersets),
    swaps:      mergeKeyMaps(local.swaps, remote.swaps),
  };
}

/** Firma stabile del bundle (esclude exportedAt) per rilevare cambi reali. */
function bundleSig(b: AppBackup): string {
  return JSON.stringify({ log: b.log, schedules: b.schedules, supersets: b.supersets, swaps: b.swaps });
}

/** Numero di sessioni nel log locale (per la salvaguardia "non pushare vuoto"). */
function localSessionCount(): number {
  const log = asLogStore(buildBackup().log);
  return log ? log.sessions.length : 0;
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

      const local = buildBackup();

      if (remoteJson) {
        let remoteRaw: unknown;
        try { remoteRaw = JSON.parse(remoteJson); } catch { remoteRaw = null; }

        const merged  = mergeBundles(local, remoteRaw);
        const mergedJson = JSON.stringify(merged);

        // Carica sul Gist il merge (così entrambi i dispositivi convergono)
        await writeToGist(mergedJson);

        // Applica in locale solo se è cambiato qualcosa di sostanziale.
        if (bundleSig(merged) !== bundleSig(local)) {
          const isLogging = window.location.pathname.includes('/esercizio/')
                         || window.location.pathname.includes('/superset/');
          if (!isLogging) {
            applyBackup(mergedJson);
            window.location.reload();
            return;
          }
        }
      } else {
        // Nessun dato remoto: carica il locale (solo se ha sessioni reali).
        if (localSessionCount() > 0) await writeToGist(JSON.stringify(local));
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
  // Push SICURO: legge il remoto, fa il merge e ricarica il merge sul Gist
  // SENZA toccare lo stato locale (non interrompe il logging in corso).
  // Salvaguardia: se il locale non ha sessioni reali, non pusha (evita di
  // sovrascrivere i dati dell'altro dispositivo con uno store vuoto).

  const doPush = useCallback(async (): Promise<void> => {
    if (!isConnected() || !alive.current) return;
    if (localSessionCount() === 0) return;
    setStatus('syncing');
    try {
      const local = buildBackup();
      let remoteRaw: unknown = null;
      const remoteJson = await readFromGist();
      if (remoteJson) { try { remoteRaw = JSON.parse(remoteJson); } catch { /* ignore */ } }

      const merged = mergeBundles(local, remoteRaw);
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
