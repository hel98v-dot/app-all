// src/hooks/useCharacterStats.ts
// Calcola le statistiche RPG del personaggio sull'intero mesociclo.

import { useDeferredValue, useMemo } from 'react';
import { useLogStore }     from './useLogStore';
import { useProgramData }  from './useProgramData';
import type { SessionLog } from '../types';
import {
  STAT_TARGETS,
  GLOBAL_LEVEL_WEIGHTS,
  STRENGTH_PRIMARY_IDS,
  CORE_ANTI_MOVEMENT_IDS,
  getEnduranceHighRepsIds,
  type CharacterStats,
} from '../data/character';

// ── Normalizzazione ───────────────────────────────────────────────────────────

function normalize(actual: number, target: number): number {
  return Math.min(100, Math.round((actual / target) * 100));
}

// ── Calcolo puro (fuori dall'hook, testabile) ─────────────────────────────────

function buildStats(sessions: SessionLog[], muscleMap: Record<string, string>): CharacterStats {
  const strengthSet  = new Set(STRENGTH_PRIMARY_IDS);
  const coreSet      = new Set(CORE_ANTI_MOVEMENT_IDS);
  const enduranceSet = new Set(getEnduranceHighRepsIds());

  let volForza      = 0;
  let volResistenza = 0;
  let volCore       = 0;
  let volMesocycle  = 0;
  let volGlutei     = 0;
  const volByWeek: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sessionsCompleted = 0;

  for (const session of sessions) {
    const wk = session.weekNumber;

    // Una sessione è "completata" se ha almeno un volume > 0
    const sessionVol = session.exercises.reduce(
      (acc, ex) => acc + ex.sets.reduce((a, s) => a + s.reps * s.kg, 0),
      0,
    );
    if (sessionVol > 0) sessionsCompleted++;

    for (const exLog of session.exercises) {
      const vol = exLog.sets.reduce((acc, s) => acc + s.reps * s.kg, 0);
      const eid = exLog.exerciseId;

      volMesocycle += vol;
      if (wk >= 1 && wk <= 5) volByWeek[wk] = (volByWeek[wk] ?? 0) + vol;

      if (strengthSet.has(eid))  volForza      += vol;
      if (coreSet.has(eid))      volCore       += vol;
      if (enduranceSet.has(eid)) volResistenza += vol;

      const muscle = muscleMap[eid];
      if (muscle === 'Glutei')   volGlutei     += vol;
    }
  }

  const volWeek1 = volByWeek[1] ?? 0;
  const volWeek4 = volByWeek[4] ?? 0;

  // ── Statistiche normalizzate 0-100 ─────────────────────────────────────────
  const forza      = normalize(volForza,          STAT_TARGETS.forza);
  const resistenza = normalize(volResistenza,     STAT_TARGETS.resistenza);
  const costanza   = normalize(sessionsCompleted, STAT_TARGETS.costanza);
  const volume     = normalize(volMesocycle,      STAT_TARGETS.volume);
  const core       = normalize(volCore,           STAT_TARGETS.core);

  // ── Livello globale (media pesata) ─────────────────────────────────────────
  const globalLevel = Math.min(100, Math.round(
    forza      * GLOBAL_LEVEL_WEIGHTS.forza      +
    resistenza * GLOBAL_LEVEL_WEIGHTS.resistenza +
    costanza   * GLOBAL_LEVEL_WEIGHTS.costanza   +
    volume     * GLOBAL_LEVEL_WEIGHTS.volume     +
    core       * GLOBAL_LEVEL_WEIGHTS.core,
  ));

  const xp = Math.round(volMesocycle / 100);

  // ── Achievement ────────────────────────────────────────────────────────────
  const unlockedAchievements: string[] = [];

  if (volGlutei > 20_000)                         unlockedAchievements.push('iron-glutes');
  if (core >= 70)                                  unlockedAchievements.push('core-warrior');
  if (forza >= 60)                                 unlockedAchievements.push('strong-intermediate');
  if (costanza >= 95)                              unlockedAchievements.push('perfect-attendance');
  if (volume >= 80)                                unlockedAchievements.push('volume-beast');
  if ([forza, resistenza, costanza, volume, core].every(s => s >= 60))
                                                   unlockedAchievements.push('well-rounded-hero');
  if (volWeek1 > 0 && volWeek4 >= volWeek1 * 1.2) unlockedAchievements.push('progressive-overload');
  if (globalLevel >= 80)                           unlockedAchievements.push('legend');

  return {
    forza, resistenza, costanza, volume, core,
    globalLevel, xp, unlockedAchievements,
    raw: { volForza, volResistenza, volCore, volMesocycle, sessionsCompleted, volGlutei, volWeek1, volWeek4 },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface CharacterStatsWithStale extends CharacterStats {
  isStale: boolean;
}

export function useCharacterStats(): CharacterStatsWithStale {
  const { store }  = useLogStore();
  const program    = useProgramData();
  const deferred   = useDeferredValue(store.sessions);
  const isStale    = deferred !== store.sessions;
  const stats      = useMemo(
    () => buildStats(deferred, program.getMuscleMap()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferred],
  );
  return { ...stats, isStale };
}
