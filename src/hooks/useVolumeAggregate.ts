// src/hooks/useVolumeAggregate.ts
// Aggrega il volume loggato per settimana e per coppia muscolo × settimana.

import { useDeferredValue, useMemo } from 'react';
import { getMuscleMap, MUSCLES, type Muscle } from '../data/program';
import { useLogStore }    from './useLogStore';
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

function buildAggregate(sessions: SessionLog[]): VolumeAggregateResult {
  const muscleMap = getMuscleMap();           // exerciseId → Muscle

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
  const deferred    = useDeferredValue(store.sessions);
  const isStale     = deferred !== store.sessions;

  const result = useMemo(
    () => buildAggregate(deferred),
    [deferred],
  );

  return { ...result, isStale };
}
