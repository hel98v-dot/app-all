// src/hooks/useProgramData.ts
// Restituisce il programma della SCHEDA ATTIVA per il profilo corrente.
// Espone anche l'unione di tutte le schede (per le statistiche cumulative).

import { useMemo } from 'react';
import {
  BASE_SESSIONS,
  getDayKeyFromDate,
  getMuscleMap as getDefaultMuscleMap,
  WEEKS,
  type DayKey,
  type Exercise,
  type Muscle,
  type Session,
  type Week,
} from '../data/program';
import { readSchedules, getActiveSessions, type StoredSchedule } from '../lib/schedules';

// ── Genera le 5 settimane da un set di sessioni (come program.ts) ──────────

function makeWeeks(sessions: Session[]): Week[] {
  const deload: Session[] = sessions.map(s => ({
    ...s,
    exercises: s.exercises.map(e => ({
      ...e,
      prescribedSets: Math.max(e.prescribedSets - 1, 2),
      rpeTarget: '5-6',
    })),
  }));
  return [
    { number: 1, label: 'Settimana 1', isDeload: false, sessions },
    { number: 2, label: 'Settimana 2', isDeload: false, sessions },
    { number: 3, label: 'Settimana 3', isDeload: false, sessions },
    { number: 4, label: 'Settimana 4', isDeload: false, sessions },
    { number: 5, label: 'Settimana 5 (Deload)', isDeload: true, sessions: deload },
  ];
}

function buildMuscleMap(sessions: Session[]): Record<string, Muscle> {
  const map: Record<string, Muscle> = {};
  for (const s of sessions) {
    for (const ex of s.exercises) {
      map[ex.id] = ex.muscle;
    }
  }
  return map;
}

// ── Interfaccia pubblica ───────────────────────────────────────────────────

export interface ProgramData {
  baseSessions:  Session[];
  weeks:         Week[];
  isCustom:      boolean;
  getSession:    (weekNumber: number, day: DayKey) => Session | undefined;
  getWeek:       (weekNumber: number) => Week | undefined;
  findExercise:  (weekNumber: number, exerciseId: string) => { session: Session; exercise: Exercise } | undefined;
  /** Cerca un esercizio in TUTTE le schede (per lo storico cross-scheda). */
  findExerciseById: (exerciseId: string) => { session: Session; exercise: Exercise } | undefined;
  getMuscleMap:  () => Record<string, Muscle>;
  getDayKey:     () => DayKey;
  // ── Multi-scheda ──
  /** Schede custom del profilo (oltre al programma di default). */
  schedules:        StoredSchedule[];
  /** Id della scheda attiva ('default' = programma built-in). */
  activeScheduleId: string;
  /** Unione delle sessioni (default + tutte le schede) per le stat cumulative. */
  allBaseSessions:  () => Session[];
  /** Mappa id→muscolo unione di tutte le schede. */
  getAllMuscleMap:  () => Record<string, Muscle>;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useProgramData(): ProgramData {
  return useMemo(() => {
    const sched    = readSchedules();
    const active   = getActiveSessions();      // null = default built-in
    const isCustom = active !== null;
    const sessions = active ?? BASE_SESSIONS;
    const weeks    = isCustom ? makeWeeks(sessions) : WEEKS;
    const muscleMap = isCustom ? buildMuscleMap(sessions) : getDefaultMuscleMap();

    // Unione default + tutte le schede (per Personaggio, achievement, ecc.)
    const allSessions: Session[] = [...BASE_SESSIONS];
    for (const s of sched.list) allSessions.push(...s.sessions);
    const allMuscleMap = { ...getDefaultMuscleMap(), ...buildMuscleMap(allSessions) };

    function getSession(weekNumber: number, day: DayKey): Session | undefined {
      const wk = weeks.find(w => w.number === weekNumber);
      return wk?.sessions.find(s => s.day === day);
    }

    function getWeek(weekNumber: number): Week | undefined {
      return weeks.find(w => w.number === weekNumber);
    }

    function findExercise(
      weekNumber: number,
      exerciseId: string,
    ): { session: Session; exercise: Exercise } | undefined {
      const wk = getWeek(weekNumber);
      if (!wk) return undefined;
      for (const session of wk.sessions) {
        const exercise = session.exercises.find(e => e.id === exerciseId);
        if (exercise) return { session, exercise };
      }
      return undefined;
    }

    function findExerciseById(
      exerciseId: string,
    ): { session: Session; exercise: Exercise } | undefined {
      for (const session of allSessions) {
        const exercise = session.exercises.find(e => e.id === exerciseId);
        if (exercise) return { session, exercise };
      }
      return undefined;
    }

    function getDayKey(): DayKey {
      return getDayKeyFromDate(new Date());
    }

    return {
      baseSessions: sessions,
      weeks,
      isCustom,
      getSession,
      getWeek,
      findExercise,
      findExerciseById,
      getMuscleMap: () => muscleMap,
      getDayKey,
      schedules: sched.list,
      activeScheduleId: sched.activeId,
      allBaseSessions: () => allSessions,
      getAllMuscleMap: () => allMuscleMap,
    };
  }, []);
}
