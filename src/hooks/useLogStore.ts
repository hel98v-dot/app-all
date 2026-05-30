// src/hooks/useLogStore.ts
// Gestione completa della persistenza su localStorage.
// Unico punto di contatto tra React e il localStorage — nessun altro file
// deve leggere/scrivere direttamente la chiave "training-log-v1".

import { useCallback, useState } from 'react';
import type { ExerciseLog, LogStore, SessionLog } from '../types';
import { today } from '../lib/dates';

// -------------------------------------------------------------------
// Costanti
// -------------------------------------------------------------------

const STORAGE_KEY = 'training-log-v1';

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

  /** Restituisce tutte le sessioni loggate in ordine cronologico. */
  getAllSessionLogs: () => SessionLog[];

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

  // Wrapper che aggiorna stato + storage atomicamente
  const commit = useCallback((next: LogStore): void => {
    writeToStorage(next);
    setStore(next);
  }, []);

  // ---- Query -------------------------------------------------------

  const getSessionLog = useCallback(
    (weekNumber: number, sessionId: string, dateISO: string): SessionLog | undefined =>
      store.sessions.find(
        s =>
          s.weekNumber === weekNumber &&
          s.sessionId === sessionId &&
          s.date === dateISO,
      ),
    [store.sessions],
  );

  const getExerciseLog = useCallback(
    (
      weekNumber: number,
      sessionId: string,
      dateISO: string,
      exerciseId: string,
    ): ExerciseLog | undefined =>
      getSessionLog(weekNumber, sessionId, dateISO)?.exercises.find(
        e => e.exerciseId === exerciseId,
      ),
    [getSessionLog],
  );

  const getAllSessionLogs = useCallback(
    (): SessionLog[] =>
      [...store.sessions].sort((a, b) => a.date.localeCompare(b.date)),
    [store.sessions],
  );

  // ---- Mutazioni ---------------------------------------------------

  const saveSessionLog = useCallback(
    (log: SessionLog): void => {
      const idx = store.sessions.findIndex(
        s =>
          s.weekNumber === log.weekNumber &&
          s.sessionId === log.sessionId &&
          s.date === log.date,
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
      };

      // Upsert dell'esercizio nell'array exercises
      const exIdx = session.exercises.findIndex(
        e => e.exerciseId === log.exerciseId,
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

      const updatedSession: SessionLog = {
        ...existing,
        exercises: existing.exercises.filter(e => e.exerciseId !== exerciseId),
      };

      saveSessionLog(updatedSession);
    },
    [getSessionLog, saveSessionLog],
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
    saveSessionLog,
    saveExerciseLog,
    clearExerciseLog,
    exportJSON,
    importJSON,
    resetAll,
    resetMesocycle,
  };
}
