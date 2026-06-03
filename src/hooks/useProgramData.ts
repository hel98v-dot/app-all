// src/hooks/useProgramData.ts
// Restituisce il programma attivo per il profilo corrente.
// Se il profilo ha caricato una scheda Excel, usa quella.
// Altrimenti usa il programma statico di default (program.ts).

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
import { customProgramKey } from './useProfileStore';
import { seedSupersetsFromProgram } from './useSupersets';
import { repairRange } from '../lib/excelRange';

// ── Legge il programma custom da localStorage ──────────────────────────────

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

/** Ripara reps/RPE salvati come seriali-data Excel (es. "46303" → "8-10"). */
export function repairSessions(sessions: Session[]): Session[] {
  return sessions.map(s => ({
    ...s,
    exercises: s.exercises.map(e => ({
      ...e,
      repsTarget: repairRange(e.repsTarget),
      rpeTarget:  repairRange(e.rpeTarget),
    })),
  }));
}

function readCustomSessions(): Session[] | null {
  try {
    const raw = localStorage.getItem(customProgramKey(getActiveProfileId()));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session[];
    if (Array.isArray(parsed) && parsed.length > 0) return repairSessions(parsed);
  } catch { /* ignore */ }
  return null;
}

/** Salva un programma custom per il profilo attivo. */
export function saveCustomProgram(sessions: Session[]): void {
  localStorage.setItem(customProgramKey(getActiveProfileId()), JSON.stringify(sessions));
  // Pre-abbina i superset definiti nella scheda (colonna Superset)
  seedSupersetsFromProgram(sessions);
  window.location.reload();
}

/** Rimuove il programma custom (torna al default). */
export function clearCustomProgram(): void {
  localStorage.removeItem(customProgramKey(getActiveProfileId()));
  window.location.reload();
}

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
  getMuscleMap:  () => Record<string, Muscle>;
  getDayKey:     () => DayKey;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useProgramData(): ProgramData {
  return useMemo(() => {
    const custom = readCustomSessions();
    const isCustom = custom !== null;
    const sessions = custom ?? BASE_SESSIONS;
    const weeks    = isCustom ? makeWeeks(sessions) : WEEKS;

    const muscleMap = isCustom ? buildMuscleMap(sessions) : getDefaultMuscleMap();

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
      getMuscleMap: () => muscleMap,
      getDayKey,
    };
  }, []);
}
