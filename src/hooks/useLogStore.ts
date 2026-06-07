// src/hooks/useLogStore.ts
// Gestione completa della persistenza su localStorage.
// Unico punto di contatto tra React e il localStorage — nessun altro file
// deve leggere/scrivere direttamente la chiave "training-log-v1".

import { useCallback, useState } from 'react';
import type { ExerciseLog, LogStore, SessionLog } from '../types';
import { logKey } from './useProfileStore';
import { getActiveScheduleId, DEFAULT_SCHEDULE_ID } from '../lib/schedules';
import { today } from '../lib/dates';

// -------------------------------------------------------------------
// Chiave storage — dipende dal profilo attivo
// -------------------------------------------------------------------

function getActiveProfileId(): string {
  try {
    const raw = localStorage.getItem('profiles-v1');
    if (raw) {
      const s = JSON.parse(raw) as { activeId?: string };
      if (s.activeId) return s.activeId;
    }
  } catch { /* ignore */ }
  return 'default';
}

const STORAGE_KEY = logKey(getActiveProfileId());

// -------------------------------------------------------------------
// Normalizzazione ID esercizi (retrocompatibilità)
// -------------------------------------------------------------------
// Commit 07b0017 ha cambiato la generazione degli ID da "${dayKey}-N"
// (es. "giovedi-0") a "${sessionId}-N" (es. "gio-0").
// Questa funzione mappa entrambe le forme a un canone breve, così
// getExerciseLog trova comunque i log salvati con il vecchio formato.
const EX_ID_PREFIX_MAP: Record<string, string> = {
  'lunedi':    'lun',
  'martedi':   'mar',
  'mercoledi': 'mer',
  'giovedi':   'gio',
  'venerdi':   'ven',
  'sabato':    'sab',
  'domenica':  'dom',
};

function canonExId(id: string): string {
  for (const [full, short] of Object.entries(EX_ID_PREFIX_MAP)) {
    if (id.startsWith(full + '-')) return short + id.slice(full.length);
  }
  return id;
}

// -------------------------------------------------------------------
// Isolamento per scheda (scheduleId)
// -------------------------------------------------------------------
// Le sessioni sono taggate con lo scheduleId della scheda attiva al momento
// del log. Le query/mutazioni di Oggi e dei logger operano SEMPRE sulla scheda
// attiva: scopando i lookup evitiamo che i dati di una scheda "sporchino"
// un'altra (es. una nuova scheda che mostra i giorni già fatti in un'altra).
// Le sessioni senza scheduleId (vecchi dati) sono trattate come 'default'.

function sessionScheduleId(s: SessionLog): string {
  return s.scheduleId ?? DEFAULT_SCHEDULE_ID;
}

/** True se la sessione appartiene alla scheda data. */
function inSchedule(s: SessionLog, scheduleId: string): boolean {
  return sessionScheduleId(s) === scheduleId;
}

// -------------------------------------------------------------------
// Helpers puri (fuori dall'hook — niente re-render)
// -------------------------------------------------------------------

/** Costruisce uno store vuoto con startDate = oggi. */
function makeEmptyStore(): LogStore {
  return { startDate: today(), sessions: [] };
}

/**
 * Legge e deserializza il LogStore dal localStorage.
 * Se assente o corrotto restituisce uno store vuoto (con startDate = oggi).
 * Se il campo startDate manca viene inserito al volo (migrazione forward-compat).
 */
function readFromStorage(): LogStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeEmptyStore();

    const parsed: unknown = JSON.parse(raw);

    // Validazione minima della struttura
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('sessions' in parsed) ||
      !Array.isArray((parsed as Record<string, unknown>).sessions)
    ) {
      return makeEmptyStore();
    }

    const store = parsed as LogStore;

    // Migrazione: se startDate manca lo impostiamo a oggi
    if (typeof store.startDate !== 'string' || store.startDate === '') {
      store.startDate = today();
    }

    return store;
  } catch {
    // JSON.parse ha lanciato: dati corrotti, partiamo da zero
    return makeEmptyStore();
  }
}

/** Serializza e persiste il LogStore su localStorage. */
function writeToStorage(store: LogStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// -------------------------------------------------------------------
// Tipo di ritorno pubblico dell'hook
// -------------------------------------------------------------------

export interface UseLogStoreReturn {
  /** Snapshot corrente dell'intero store (read-only per i consumer). */
  store: LogStore;

  /** Shortcut a store.startDate (data inizio mesociclo). */
  startDate: string;

  // ---- Query -------------------------------------------------------

  /**
   * Cerca il log di una sessione per settimana, id-sessione e data.
   * Restituisce undefined se non ancora loggata.
   */
  getSessionLog: (
    weekNumber: number,
    sessionId: string,
    dateISO: string,
  ) => SessionLog | undefined;

  /**
   * Cerca il log di un singolo esercizio all'interno di una sessione.
   * Restituisce undefined se non ancora loggato.
   */
  getExerciseLog: (
    weekNumber: number,
    sessionId: string,
    dateISO: string,
    exerciseId: string,
  ) => ExerciseLog | undefined;

  /** Restituisce tutte le sessioni loggate in ordine cronologico (TUTTE le schede). */
  getAllSessionLogs: () => SessionLog[];

  /** Solo le sessioni della scheda attiva, in ordine cronologico. */
  getActiveSessionLogs: () => SessionLog[];

  // ---- Mutazioni ---------------------------------------------------

  /**
   * Salva (insert o update) un intero SessionLog.
   * Identifica il record per la tripla (weekNumber, sessionId, date).
   */
  saveSessionLog: (log: SessionLog) => void;

  /**
   * Upsert del log di un singolo esercizio all'interno della sessione
   * identificata da (weekNumber, sessionId, dateISO).
   * Se la sessione non esiste la crea al volo.
   */
  saveExerciseLog: (
    weekNumber: number,
    sessionId: string,
    dateISO: string,
    log: ExerciseLog,
  ) => void;

  /**
   * Rimuove il log di un singolo esercizio dalla sessione.
   * Se la sessione rimane senza esercizi, viene comunque mantenuta nel log
   * (traccia che la sessione è stata aperta).
   */
  clearExerciseLog: (
    weekNumber: number,
    sessionId: string,
    dateISO: string,
    exerciseId: string,
  ) => void;

  // ---- Import / Export / Reset ------------------------------------

  /** Serializza l'intero store in JSON leggibile. */
  exportJSON: () => string;

  /**
   * Importa un JSON prodotto da exportJSON.
   * Restituisce true se il parsing e la validazione sono andati a buon fine,
   * false altrimenti (lo store non viene modificato).
   */
  importJSON: (jsonString: string) => boolean;

  /** Cancella tutto e riparte da uno store vuoto (startDate = oggi). */
  resetAll: () => void;

  /**
   * Resetta solo startDate a oggi, mantenendo tutti i log delle sessioni.
   * Usato per "ricominciare il blocco" dopo la settimana 5.
   */
  resetMesocycle: () => void;
}

// -------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------

export function useLogStore(): UseLogStoreReturn {
  // Lo stato React è inizializzato una sola volta leggendo localStorage.
  // Ogni mutazione aggiorna sia lo stato React (triggera il re-render dei
  // consumer) sia localStorage (persistenza).
  const [store, setStore] = useState<LogStore>(readFromStorage);

  // Wrapper che aggiorna stato + storage atomicamente.
  // Dispatcha 'log-store-update' per notificare il DriveSync context
  // di eseguire un push debounced verso Google Drive.
  const commit = useCallback((next: LogStore): void => {
    writeToStorage(next);
    setStore(next);
    try { window.dispatchEvent(new CustomEvent('log-store-update')); } catch { /* ignore */ }
  }, []);

  // ---- Query -------------------------------------------------------

  const getSessionLog = useCallback(
    (weekNumber: number, sessionId: string, dateISO: string): SessionLog | undefined => {
      const active = getActiveScheduleId();
      return store.sessions.find(
        s =>
          s.weekNumber === weekNumber &&
          s.sessionId === sessionId &&
          s.date === dateISO &&
          inSchedule(s, active),
      );
    },
    [store.sessions],
  );

  const getExerciseLog = useCallback(
    (
      weekNumber: number,
      sessionId: string,
      dateISO: string,
      exerciseId: string,
    ): ExerciseLog | undefined => {
      const session = getSessionLog(weekNumber, sessionId, dateISO);
      if (!session) return undefined;
      // Tentativo esatto
      const exact = session.exercises.find(e => e.exerciseId === exerciseId);
      if (exact) return exact;
      // Fallback: confronto con ID normalizzato (gestisce 'giovedi-0' ↔ 'gio-0')
      const normId = canonExId(exerciseId);
      return session.exercises.find(e => canonExId(e.exerciseId) === normId);
    },
    [getSessionLog],
  );

  const getAllSessionLogs = useCallback(
    (): SessionLog[] =>
      [...store.sessions].sort((a, b) => a.date.localeCompare(b.date)),
    [store.sessions],
  );

  const getActiveSessionLogs = useCallback(
    (): SessionLog[] => {
      const active = getActiveScheduleId();
      return store.sessions
        .filter(s => inSchedule(s, active))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    [store.sessions],
  );

  // ---- Mutazioni ---------------------------------------------------

  const saveSessionLog = useCallback(
    (log: SessionLog): void => {
      // Identità completa: (scheduleId, week, sessionId, date). Includere lo
      // scheduleId evita di sovrascrivere la sessione di un'altra scheda che
      // condivide lo stesso giorno (es. due schede con la sessione 'gio').
      const logSchedId = sessionScheduleId(log);
      const idx = store.sessions.findIndex(
        s =>
          s.weekNumber === log.weekNumber &&
          s.sessionId === log.sessionId &&
          s.date === log.date &&
          sessionScheduleId(s) === logSchedId,
      );

      const next: LogStore = {
        ...store,
        sessions:
          idx === -1
            ? [...store.sessions, log]
            : store.sessions.map((s, i) => (i === idx ? log : s)),
      };

      commit(next);
    },
    [store, commit],
  );

  const saveExerciseLog = useCallback(
    (
      weekNumber: number,
      sessionId: string,
      dateISO: string,
      log: ExerciseLog,
    ): void => {
      const existing = getSessionLog(weekNumber, sessionId, dateISO);

      // Crea la sessione contenitore se non esiste ancora
      const session: SessionLog = existing ?? {
        id: crypto.randomUUID(),
        weekNumber,
        sessionId,
        date: dateISO,
        exercises: [],
        scheduleId: getActiveScheduleId(),
      };

      // Upsert dell'esercizio nell'array exercises.
      // Usa anche il confronto normalizzato così 'giovedi-0' viene trovato
      // quando si salva con il nuovo id 'gio-0' (retrocompatibilità).
      const normLogId = canonExId(log.exerciseId);
      const exIdx = session.exercises.findIndex(
        e => e.exerciseId === log.exerciseId || canonExId(e.exerciseId) === normLogId,
      );
      const updatedExercises: ExerciseLog[] =
        exIdx === -1
          ? [...session.exercises, log]
          : session.exercises.map((e, i) => (i === exIdx ? log : e));

      const updatedSession: SessionLog = {
        ...session,
        exercises: updatedExercises,
      };

      saveSessionLog(updatedSession);
    },
    [getSessionLog, saveSessionLog],
  );

  const clearExerciseLog = useCallback(
    (
      weekNumber: number,
      sessionId: string,
      dateISO: string,
      exerciseId: string,
    ): void => {
      const existing = getSessionLog(weekNumber, sessionId, dateISO);
      if (!existing) return;

      const normId = canonExId(exerciseId);
      const exercises = existing.exercises.filter(
        e => e.exerciseId !== exerciseId && canonExId(e.exerciseId) !== normId,
      );

      if (exercises.length === 0) {
        // Sessione rimasta vuota → rimuovila del tutto, così sparisce da
        // calendario, registro e volume (anche se era stata aperta in passato).
        // Scopata sullo scheduleId della sessione trovata, per non toccare
        // sessioni omonime di altre schede.
        const existingSchedId = sessionScheduleId(existing);
        commit({
          ...store,
          sessions: store.sessions.filter(
            s => !(
              s.weekNumber === weekNumber &&
              s.sessionId === sessionId &&
              s.date === dateISO &&
              sessionScheduleId(s) === existingSchedId
            ),
          ),
        });
      } else {
        saveSessionLog({ ...existing, exercises });
      }
    },
    [getSessionLog, saveSessionLog, store, commit],
  );

  // ---- Import / Export / Reset ------------------------------------

  const exportJSON = useCallback(
    (): string => JSON.stringify(store, null, 2),
    [store],
  );

  const importJSON = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed: unknown = JSON.parse(jsonString);

        // Validazione: deve avere startDate string e sessions array
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          typeof (parsed as Record<string, unknown>).startDate !== 'string' ||
          !Array.isArray((parsed as Record<string, unknown>).sessions)
        ) {
          return false;
        }

        // Validazione superficiale di ogni SessionLog
        const sessions = (parsed as LogStore).sessions;
        const isValid = sessions.every(
          s =>
            typeof s.id === 'string' &&
            typeof s.weekNumber === 'number' &&
            typeof s.sessionId === 'string' &&
            typeof s.date === 'string' &&
            Array.isArray(s.exercises),
        );
        if (!isValid) return false;

        commit(parsed as LogStore);
        return true;
      } catch {
        return false;
      }
    },
    [commit],
  );

  const resetAll = useCallback((): void => {
    commit(makeEmptyStore());
  }, [commit]);

  const resetMesocycle = useCallback((): void => {
    commit({ ...store, startDate: today() });
  }, [store, commit]);

  // ---- Return ------------------------------------------------------

  return {
    store,
    startDate: store.startDate,
    getSessionLog,
    getExerciseLog,
    getAllSessionLogs,
    getActiveSessionLogs,
    saveSessionLog,
    saveExerciseLog,
    clearExerciseLog,
    exportJSON,
    importJSON,
    resetAll,
    resetMesocycle,
  };
}
