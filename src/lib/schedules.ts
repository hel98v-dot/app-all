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
// Modello SEMPLIFICATO: un solo programma personalizzato per profilo, con id
// canonico fisso. Niente più liste di schede multiple → niente proliferazione,
// niente orfani da id che cambiano, re-import = sostituzione dello stesso id.
export const CUSTOM_SCHEDULE_ID = 'sched-1';

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

/** True se la scheda data ha almeno 1 serie loggata (reps > 0). */
function scheduleHasLogs(pid: string, scheduleId: string): boolean {
  try {
    const raw = localStorage.getItem(logKeyFor(pid));
    if (!raw) return false;
    const store = JSON.parse(raw) as { sessions?: RawSession[] };
    if (!Array.isArray(store?.sessions)) return false;
    return store.sessions.some(
      s => (s.scheduleId ?? DEFAULT_SCHEDULE_ID) === scheduleId
        && s.exercises.some(e => e.sets.some(set => set.reps > 0)),
    );
  } catch { return false; }
}

/** Ri-tagga tutti i log custom (scheduleId ≠ 'default') sull'id canonico 'sched-1'. */
function retagCustomLogsToSingle(pid: string): void {
  try {
    const raw = localStorage.getItem(logKeyFor(pid));
    if (!raw) return;
    const log = JSON.parse(raw) as { sessions?: SessionLog[] };
    if (!Array.isArray(log.sessions)) return;
    let changed = false;
    for (const s of log.sessions) {
      const sid = s.scheduleId ?? DEFAULT_SCHEDULE_ID;
      if (sid !== DEFAULT_SCHEDULE_ID && sid !== CUSTOM_SCHEDULE_ID) {
        s.scheduleId = CUSTOM_SCHEDULE_ID;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(logKeyFor(pid), JSON.stringify(log));
  } catch { /* ignore */ }
}

/**
 * MIGRAZIONE al modello "un solo programma per profilo".
 * Se esistono più schede custom (vecchio modello), le collassa in UNA con id
 * canonico 'sched-1', conservando la definizione di quella con più dati loggati
 * e ri-taggando tutti i log custom su 'sched-1'. Da chiamare UNA volta all'avvio,
 * prima di reconcileActiveProfile(). Idempotente.
 */
export function collapseToSingleCustomSchedule(): void {
  const pid = activeProfileId();
  const sched = readRaw(pid);
  if (!sched) return;
  const customs = sched.list;
  if (customs.length === 0) return; // niente da collassare

  // Scegli la definizione da conservare: quella con più log, poi l'attiva, poi la prima.
  const owner = scheduleIdWithMostLogs(pid);
  const keeper =
    customs.find(s => s.id === owner) ??
    customs.find(s => s.id === sched.activeId) ??
    customs[0]!;

  // Unifica i tag dei log custom su 'sched-1'.
  retagCustomLogsToSingle(pid);

  const single: StoredSchedule = { ...keeper, id: CUSTOM_SCHEDULE_ID };
  const activeWasCustom = sched.activeId !== DEFAULT_SCHEDULE_ID;
  const newActive = activeWasCustom ? CUSTOM_SCHEDULE_ID : sched.activeId;

  const needsRewrite =
    customs.length > 1 || keeper.id !== CUSTOM_SCHEDULE_ID || sched.activeId !== newActive;
  if (needsRewrite) {
    writeRaw(pid, { activeId: newActive, list: [single] });
  }
}

/**
 * Riconciliazione dei dati del profilo attivo, da chiamare UNA volta all'avvio.
 * È il cuore della robustezza contro i dati "invisibili":
 *  1. Ri-tagga i log ORFANI (scheduleId che non corrisponde ad alcuna scheda)
 *     assegnandoli alla scheda giusta, così non spariscono mai dalla vista.
 *  2. Se la scheda attiva è VUOTA ma un'altra scheda valida possiede dati,
 *     attiva quest'ultima → l'utente atterra direttamente sui propri allenamenti.
 * Un flag di sessione ('arise-skip-heal') evita di annullare l'attivazione di
 * una scheda appena scelta/aggiunta dall'utente.
 */
export function reconcileActiveProfile(): void {
  const pid = activeProfileId();
  const sched = readRaw(pid);
  const listIds = sched?.list.map(s => s.id) ?? [];
  // 'default' e 'sched-1' sono SEMPRE id validi (i due unici possibili nel
  // modello a programma singolo): così i log custom non diventano mai orfani.
  const validIds = new Set<string>([DEFAULT_SCHEDULE_ID, CUSTOM_SCHEDULE_ID, ...listIds]);

  const logRaw = localStorage.getItem(logKeyFor(pid));
  if (!logRaw) return;
  let log: { startDate?: string; sessions?: SessionLog[] };
  try { log = JSON.parse(logRaw); } catch { return; }
  if (!Array.isArray(log.sessions)) return;

  // 1. Bersaglio per i log orfani: se esiste un programma custom → 'sched-1'
  //    (i log orfani sono dati custom), altrimenti → 'default'.
  const hasCustom = listIds.length > 0;
  const retagTarget = hasCustom ? CUSTOM_SCHEDULE_ID : DEFAULT_SCHEDULE_ID;

  let changed = false;
  for (const s of log.sessions) {
    const sid = s.scheduleId ?? DEFAULT_SCHEDULE_ID;
    if (!validIds.has(sid)) { s.scheduleId = retagTarget; changed = true; }
  }
  if (changed) {
    try { localStorage.setItem(logKeyFor(pid), JSON.stringify(log)); } catch { /* ignore */ }
  }

  // 2. Heal della scheda attiva (solo se è vuota e un'altra possiede dati).
  if (sched) {
    let skip = false;
    try {
      skip = sessionStorage.getItem('arise-skip-heal') === '1';
      sessionStorage.removeItem('arise-skip-heal');
    } catch { /* ignore */ }

    if (!skip && !scheduleHasLogs(pid, sched.activeId)) {
      const owner = scheduleIdWithMostLogs(pid);
      // Attiva la scheda-proprietaria SOLO se è realmente mostrabile: 'default'
      // oppure una scheda con definizione presente. Non attiviamo 'sched-1' se
      // manca la sua definizione (i suoi log restano comunque taggati, pronti a
      // ricomparire quando si ricarica l'Excel).
      const activatable = owner === DEFAULT_SCHEDULE_ID || listIds.includes(owner ?? '');
      if (owner && owner !== sched.activeId && activatable) {
        sched.activeId = owner;
        writeRaw(pid, sched);
      }
    }
  }
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
  // L'utente ha scelto esplicitamente questa scheda: non farti "ricorreggere"
  // dalla riconciliazione all'avvio (che altrimenti tornerebbe sulla scheda
  // con più dati se questa è vuota).
  try { sessionStorage.setItem('arise-skip-heal', '1'); } catch { /* ignore */ }
  window.location.reload();
}

// ── API programma singolo ─────────────────────────────────────────────────────

/**
 * Imposta (o SOSTITUISCE) il programma personalizzato del profilo.
 * Usa sempre l'id canonico 'sched-1': re-importare lo stesso programma non crea
 * duplicati e i log già registrati restano agganciati.
 */
export function setCustomSchedule(name: string, sessions: Session[]): void {
  const pid = activeProfileId();
  const store = readRaw(pid) ?? { activeId: DEFAULT_SCHEDULE_ID, list: [] };
  store.list = [{
    id: CUSTOM_SCHEDULE_ID,
    name: name.trim() || 'La mia scheda',
    sessions: repairSessions(sessions),
  }];
  store.activeId = CUSTOM_SCHEDULE_ID;
  writeRaw(pid, store);
  seedSupersetsFromProgram(sessions);
  try { sessionStorage.setItem('arise-skip-heal', '1'); } catch { /* ignore */ }
  window.location.reload();
}

/** Rimuove il programma personalizzato e torna al predefinito (i log restano). */
export function removeCustomSchedule(): void {
  const pid = activeProfileId();
  const store = readRaw(pid) ?? { activeId: DEFAULT_SCHEDULE_ID, list: [] };
  store.list = [];
  store.activeId = DEFAULT_SCHEDULE_ID;
  writeRaw(pid, store);
  try { sessionStorage.setItem('arise-skip-heal', '1'); } catch { /* ignore */ }
  window.location.reload();
}

/** Rinomina il programma personalizzato. */
export function renameCustomSchedule(name: string): void {
  const pid = activeProfileId();
  const store = readRaw(pid);
  if (!store || store.list.length === 0) return;
  store.list[0]!.name = name.trim().slice(0, 40) || store.list[0]!.name;
  writeRaw(pid, store);
  window.location.reload();
}
