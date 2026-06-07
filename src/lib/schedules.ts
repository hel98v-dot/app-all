// src/lib/schedules.ts
// Gestione di più schede Excel per profilo. Una scheda è attiva alla volta.
// Esercizi (Oggi) e Volume seguono la scheda attiva (i log sono taggati con
// lo scheduleId); Personaggio/peso/achievement restano cumulativi.

import type { Session } from '../data/program';
import type { SessionLog } from '../types';
import { repairRange } from './excelRange';
import { seedSupersetsFromProgram } from '../hooks/useSupersets';

export interface StoredSchedule { id: string; name: string; sessions: Session[]; }
export interface SchedulesStore { activeId: string; list: StoredSchedule[]; }

export const DEFAULT_SCHEDULE_ID = 'default';

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem('profiles-v1');
    if (raw) {
      const s = JSON.parse(raw) as { activeId?: string };
      if (s.activeId) return s.activeId;
    }
  } catch { /* ignore */ }
  return 'default';
}

function schedulesKey(pid: string): string { return `schedules-v1-${pid}`; }
function logKeyFor(pid: string): string { return pid === 'default' ? 'training-log-v1' : `training-log-v1-${pid}`; }
function customProgramKey(pid: string): string { return `custom-program-v1-${pid}`; }

/** Ripara reps/RPE salvati come seriali-data Excel (es. "46303" → "8-10"). */
export function repairSessions(sessions: Session[]): Session[] {
  return sessions.map(s => ({
    ...s,
    exercises: s.exercises.map(e => ({ ...e, repsTarget: repairRange(e.repsTarget), rpeTarget: repairRange(e.rpeTarget) })),
  }));
}

function readRaw(pid: string): SchedulesStore | null {
  try {
    const raw = localStorage.getItem(schedulesKey(pid));
    if (raw) {
      const parsed = JSON.parse(raw) as SchedulesStore;
      if (parsed && Array.isArray(parsed.list) && typeof parsed.activeId === 'string') return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function writeRaw(pid: string, store: SchedulesStore): void {
  try { localStorage.setItem(schedulesKey(pid), JSON.stringify(store)); } catch { /* ignore */ }
}

type RawSession = { scheduleId?: string; exercises: Array<{ sets: Array<{ reps: number }> }> };

/**
 * Restituisce lo scheduleId che possiede il maggior numero di serie loggate
 * (reps > 0), o null se non ci sono dati. Serve a ripiegare su una scheda
 * "viva" quando l'activeId è invalido.
 */
function scheduleIdWithMostLogs(pid: string): string | null {
  try {
    const raw = localStorage.getItem(logKeyFor(pid));
    if (!raw) return null;
    const store = JSON.parse(raw) as { sessions?: RawSession[] };
    if (!Array.isArray(store?.sessions)) return null;
    const tally = new Map<string, number>();
    for (const s of store.sessions) {
      const sid = s.scheduleId ?? DEFAULT_SCHEDULE_ID;
      const sets = s.exercises.reduce(
        (a, e) => a + e.sets.filter(set => set.reps > 0).length, 0,
      );
      if (sets > 0) tally.set(sid, (tally.get(sid) ?? 0) + sets);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [sid, n] of tally) {
      if (n > bestN) { best = sid; bestN = n; }
    }
    return best;
  } catch { return null; }
}

/** Tagga (una volta) i log senza scheduleId con l'id dato. */
function migrateLogScheduleIds(pid: string, scheduleId: string): void {
  try {
    const raw = localStorage.getItem(logKeyFor(pid));
    if (!raw) return;
    const store = JSON.parse(raw) as { startDate: string; sessions: SessionLog[] };
    if (!Array.isArray(store?.sessions) || store.sessions.length === 0) return;
    let changed = false;
    for (const s of store.sessions) {
      if (!s.scheduleId) { s.scheduleId = scheduleId; changed = true; }
    }
    if (changed) localStorage.setItem(logKeyFor(pid), JSON.stringify(store));
  } catch { /* ignore */ }
}

/** Legge lo store schede, migrando dalla vecchia scheda singola al primo accesso. */
export function readSchedules(): SchedulesStore {
  const pid = activeProfileId();
  const existing = readRaw(pid);
  if (existing) {
    let activeId = existing.activeId;
    // activeId valido = 'default' (programma built-in) OPPURE una scheda esistente.
    // NB: 'default' resta sempre valido, così i log registrati sul programma
    // predefinito non spariscono quando si carica una scheda Excel.
    // L'unico auto-fix sicuro: se l'activeId punta a una scheda inesistente
    // (né 'default' né presente nella lista), ripiega su una valida — preferendo
    // quella che possiede più dati loggati. NON spostiamo mai automaticamente
    // l'utente tra schede entrambe valide (lo farebbe perdere di vista i dati);
    // il recupero "dati in un'altra scheda" è gestito da un banner in Oggi.
    const valid = activeId === DEFAULT_SCHEDULE_ID || existing.list.some(s => s.id === activeId);
    if (!valid) {
      const owner = scheduleIdWithMostLogs(pid);
      const ownerValid = owner != null
        && (owner === DEFAULT_SCHEDULE_ID || existing.list.some(s => s.id === owner));
      activeId = (ownerValid ? owner : null)
        ?? existing.list[0]?.id
        ?? DEFAULT_SCHEDULE_ID;
      writeRaw(pid, { ...existing, activeId });
    }

    return {
      activeId,
      list: existing.list.map(s => ({ ...s, sessions: repairSessions(s.sessions) })),
    };
  }

  // Migrazione: custom-program-v1 → scheda "sched-1"
  try {
    const raw = localStorage.getItem(customProgramKey(pid));
    if (raw) {
      const sessions = JSON.parse(raw) as Session[];
      if (Array.isArray(sessions) && sessions.length > 0) {
        const store: SchedulesStore = {
          activeId: 'sched-1',
          list: [{ id: 'sched-1', name: 'Scheda 1', sessions: repairSessions(sessions) }],
        };
        writeRaw(pid, store);
        migrateLogScheduleIds(pid, 'sched-1');
        return store;
      }
    }
  } catch { /* ignore */ }

  const empty: SchedulesStore = { activeId: DEFAULT_SCHEDULE_ID, list: [] };
  writeRaw(pid, empty);
  migrateLogScheduleIds(pid, DEFAULT_SCHEDULE_ID);
  return empty;
}

export function getActiveScheduleId(): string {
  return readRaw(activeProfileId())?.activeId ?? DEFAULT_SCHEDULE_ID;
}

/**
 * True se esistono log registrati sul programma PREDEFINITO (scheduleId
 * 'default' o assente) con almeno una serie svolta. Serve a mostrare la voce
 * "Predefinita" nel selettore così quei dati restano sempre raggiungibili.
 */
export function hasDefaultProgramData(
  sessions: Array<{ scheduleId?: string; exercises: Array<{ sets: Array<{ reps: number }> }> }>,
): boolean {
  return sessions.some(
    s => (s.scheduleId ?? DEFAULT_SCHEDULE_ID) === DEFAULT_SCHEDULE_ID
      && s.exercises.some(e => e.sets.some(set => set.reps > 0)),
  );
}

/** Sessioni della scheda attiva (null = programma di default built-in). */
export function getActiveSessions(): Session[] | null {
  const store = readSchedules();
  if (store.activeId === DEFAULT_SCHEDULE_ID) return null;
  const sch = store.list.find(s => s.id === store.activeId);
  return sch ? sch.sessions : null;
}

export function switchSchedule(id: string): void {
  const pid = activeProfileId();
  const store = readRaw(pid) ?? { activeId: DEFAULT_SCHEDULE_ID, list: [] };
  store.activeId = id;
  writeRaw(pid, store);
  window.location.reload();
}

export function addSchedule(name: string, sessions: Session[]): void {
  const pid = activeProfileId();
  const store = readRaw(pid) ?? { activeId: DEFAULT_SCHEDULE_ID, list: [] };
  const ids = new Set(store.list.map(s => s.id));
  let n = store.list.length + 1;
  let id = `sched-${n}`;
  while (ids.has(id)) { n++; id = `sched-${n}`; }
  store.list.push({ id, name: name.trim() || `Scheda ${n}`, sessions: repairSessions(sessions) });
  store.activeId = id;
  writeRaw(pid, store);
  seedSupersetsFromProgram(sessions); // pre-abbina i superset definiti nella scheda
  window.location.reload();
}

export function deleteSchedule(id: string): void {
  const pid = activeProfileId();
  const store = readRaw(pid);
  if (!store) return;
  store.list = store.list.filter(s => s.id !== id);
  if (store.activeId === id) store.activeId = store.list[0]?.id ?? DEFAULT_SCHEDULE_ID;
  writeRaw(pid, store);
  window.location.reload();
}

export function renameSchedule(id: string, name: string): void {
  const pid = activeProfileId();
  const store = readRaw(pid);
  if (!store) return;
  const sch = store.list.find(s => s.id === id);
  if (!sch) return;
  sch.name = name.trim().slice(0, 40) || sch.name;
  writeRaw(pid, store);
  window.location.reload();
}
