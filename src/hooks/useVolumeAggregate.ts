// src/hooks/useVolumeAggregate.ts
// Aggrega il volume loggato per settimana e per coppia muscolo × settimana.

import { useDeferredValue, useMemo } from 'react';
import { MUSCLES, type Muscle } from '../data/program';
import { useLogStore }     from './useLogStore';
import { useProgramData }  from './useProgramData';
import { DEFAULT_SCHEDULE_ID } from '../lib/schedules';
import type { SessionLog } from '../types';

// ── Tipi pubblici ──────────────────────────────────────────────────────────────

/** volume totale per ogni settimana (1-5). Chiave = weekNumber. */
export type VolumePerWeek = Record<number, number>;

/** volume per ogni muscolo per ogni settimana. */
export type VolumePerMuscleAndWeek = Record<Muscle, VolumePerWeek>;

/**
 * Δ% tra due valori.
 * Restituisce null quando prev === 0 (si visualizza "—").
 */
export function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return null;
  return (curr - prev) / prev;
}

export interface VolumeAggregateResult {
  volumePerWeek:           VolumePerWeek;
  volumePerMuscleAndWeek:  VolumePerMuscleAndWeek;
}

// ── Helpers puri ───────────────────────────────────────────────────────────────

function emptyPerWeek(): VolumePerWeek {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function buildAggregate(sessions: SessionLog[], muscleMap: Record<string, Muscle>): VolumeAggregateResult {

  // Struttura iniziale con tutti i muscoli a zero
  const volumePerMuscleAndWeek: VolumePerMuscleAndWeek = Object.fromEntries(
    MUSCLES.map(m => [m, emptyPerWeek()]),
  ) as VolumePerMuscleAndWeek;

  const volumePerWeek: VolumePerWeek = emptyPerWeek();

  for (const session of sessions) {
    const wk = session.weekNumber;
    if (wk < 1 || wk > 5) continue;            // sanity check

    for (const exLog of session.exercises) {
      const muscle = muscleMap[exLog.exerciseId];
      if (!muscle) continue;                    // esercizio non nel programma

      const vol = exLog.sets.reduce((acc, s) => acc + s.reps * s.kg, 0);

      volumePerWeek[wk]                        = (volumePerWeek[wk] ?? 0) + vol;
      volumePerMuscleAndWeek[muscle][wk]        = (volumePerMuscleAndWeek[muscle][wk] ?? 0) + vol;
    }
  }

  return { volumePerWeek, volumePerMuscleAndWeek };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface VolumeAggregateWithStale extends VolumeAggregateResult {
  /** true mentre React sta ricalcolando in background (molti log). */
  isStale: boolean;
}

export function useVolumeAggregate(): VolumeAggregateWithStale {
  const { store }   = useLogStore();
  const program     = useProgramData();
  const deferred    = useDeferredValue(store.sessions);
  const isStale     = deferred !== store.sessions;

  const activeId = program.activeScheduleId;
  const result = useMemo(
    () => {
      // Il Volume segue la SCHEDA ATTIVA: tieni solo i log della scheda corrente.
      const filtered = deferred.filter(s => (s.scheduleId ?? DEFAULT_SCHEDULE_ID) === activeId);
      return buildAggregate(filtered, program.getMuscleMap());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferred, activeId],
  );

  return { ...result, isStale };
}
