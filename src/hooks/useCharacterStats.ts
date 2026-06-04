// src/hooks/useCharacterStats.ts
// Statistiche RPG basate sul LIVELLO relativo a riferimenti "avanzati".
// Per ogni esercizio si prende la MIGLIOR serie delle 4 settimane e la si
// confronta col riferimento avanzato (vedi EXERCISE_REFS in character.ts).
// Le stat sono quindi un livello medio generale, NON un cumulo di sessioni.

import { useDeferredValue, useMemo } from 'react';
import { useLogStore }     from './useLogStore';
import { useProgramData }  from './useProgramData';
import type { SessionLog } from '../types';
import type { Session, Exercise } from '../data/program';
import {
  GLOBAL_LEVEL_WEIGHTS,
  STRENGTH_PRIMARY_IDS,
  CORE_ANTI_MOVEMENT_IDS,
  getEnduranceHighRepsIds,
  exerciseScore,
  refSetVolume,
  type CharacterStats,
} from '../data/character';

const WORKING_WEEKS = 4;   // settimane "piene" (la 5ª è deload)

// ── Calcolo puro ───────────────────────────────────────────────────────────────

function buildStats(
  sessions: SessionLog[],
  baseSessions: Session[],
  muscleMap: Record<string, string>,
): CharacterStats {
  // Mappa id → definizione esercizio del programma attivo
  const exDef = new Map<string, Exercise>();
  for (const s of baseSessions) for (const e of s.exercises) exDef.set(e.id, e);

  // ── Gruppi di esercizi (robusti anche per programmi custom) ────────────────
  let strengthIds = STRENGTH_PRIMARY_IDS.filter(id => exDef.has(id));
  if (strengthIds.length === 0) {
    // Fallback: i 5 esercizi con riferimento di carico più alto
    strengthIds = [...exDef.values()]
      .filter(e => refSetVolume(e) > 0)
      .sort((a, b) => refSetVolume(b) - refSetVolume(a))
      .slice(0, 5)
      .map(e => e.id);
  }
  const coreIds = [...new Set([
    ...CORE_ANTI_MOVEMENT_IDS.filter(id => exDef.has(id)),
    ...[...exDef.values()].filter(e => e.muscle === 'Addome').map(e => e.id),
  ])];
  const enduranceIds = getEnduranceHighRepsIds(baseSessions);

  // ── Scansione log: best set per esercizio + volumi grezzi ──────────────────
  const bestVol  = new Map<string, number>();   // max reps×kg per esercizio
  const bestReps = new Map<string, number>();   // max reps per esercizio

  let volMesocycle = 0;
  let volForza = 0, volResistenza = 0, volCore = 0, volGlutei = 0;
  const volByWeek: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sessionsCompleted = 0;

  const strengthSet  = new Set(strengthIds);
  const coreSet      = new Set(coreIds);
  const enduranceSet = new Set(enduranceIds);

  for (const session of sessions) {
    const wk = session.weekNumber;
    const sessionVol = session.exercises.reduce(
      (acc, ex) => acc + ex.sets.reduce((a, s) => a + s.reps * s.kg, 0), 0,
    );
    if (sessionVol > 0) sessionsCompleted++;

    for (const exLog of session.exercises) {
      const eid = exLog.exerciseId;
      let exVol = 0;
      for (const set of exLog.sets) {
        const v = set.reps * set.kg;
        exVol += v;
        if (v > (bestVol.get(eid) ?? 0))        bestVol.set(eid, v);
        if (set.reps > (bestReps.get(eid) ?? 0)) bestReps.set(eid, set.reps);
      }
      volMesocycle += exVol;
      if (wk >= 1 && wk <= 5) volByWeek[wk] = (volByWeek[wk] ?? 0) + exVol;
      if (strengthSet.has(eid))  volForza      += exVol;
      if (coreSet.has(eid))      volCore       += exVol;
      if (enduranceSet.has(eid)) volResistenza += exVol;
      if (muscleMap[eid] === 'Glutei') volGlutei += exVol;
    }
  }

  // ── Punteggio medio di un gruppo (0-100) ───────────────────────────────────
  function groupScore(ids: string[]): number {
    if (ids.length === 0) return 0;
    let sum = 0;
    for (const id of ids) {
      const ex = exDef.get(id);
      if (!ex) continue;
      sum += exerciseScore(ex, bestVol.get(id) ?? 0, bestReps.get(id) ?? 0);
    }
    return Math.round((sum / ids.length) * 100);
  }

  // ── Volume massimo di riferimento (tutto il programma a livello avanzato) ───
  let referenceMaxVolume = 0;
  for (const ex of exDef.values()) {
    referenceMaxVolume += refSetVolume(ex) * ex.prescribedSets * WORKING_WEEKS;
  }

  const plannedTotal = baseSessions.length * 5;   // sessioni pianificate (5 sett.)

  // ── Stat 0-100 ─────────────────────────────────────────────────────────────
  const forza      = groupScore(strengthIds);
  const resistenza = groupScore(enduranceIds);
  const core       = groupScore(coreIds);
  const volume     = referenceMaxVolume > 0
    ? Math.round(Math.min(1, volMesocycle / referenceMaxVolume) * 100) : 0;
  const costanza   = plannedTotal > 0
    ? Math.round(Math.min(1, sessionsCompleted / plannedTotal) * 100) : 0;

  // ── Livello globale (media pesata) ─────────────────────────────────────────
  const globalLevel = Math.min(100, Math.round(
    forza      * GLOBAL_LEVEL_WEIGHTS.forza      +
    resistenza * GLOBAL_LEVEL_WEIGHTS.resistenza +
    costanza   * GLOBAL_LEVEL_WEIGHTS.costanza   +
    volume     * GLOBAL_LEVEL_WEIGHTS.volume     +
    core       * GLOBAL_LEVEL_WEIGHTS.core,
  ));

  const xp = Math.round(volMesocycle / 100);
  const volWeek1 = volByWeek[1] ?? 0;
  const volWeek4 = volByWeek[4] ?? 0;

  // ── Achievement ────────────────────────────────────────────────────────────
  const unlockedAchievements: string[] = [];
  if (volGlutei > 20_000)                          unlockedAchievements.push('iron-glutes');
  if (core >= 70)                                  unlockedAchievements.push('core-warrior');
  if (forza >= 60)                                 unlockedAchievements.push('strong-intermediate');
  if (costanza >= 95)                              unlockedAchievements.push('perfect-attendance');
  if (volume >= 80)                                unlockedAchievements.push('volume-beast');
  if ([forza, resistenza, costanza, volume, core].every(s => s >= 60))
                                                   unlockedAchievements.push('well-rounded-hero');
  if (volWeek1 > 0 && volWeek4 >= volWeek1 * 1.2)  unlockedAchievements.push('progressive-overload');
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
    // Cumulativo: considera TUTTE le schede (default + custom) e tutti i log.
    () => buildStats(deferred, program.allBaseSessions(), program.getAllMuscleMap()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferred],
  );
  return { ...stats, isStale };
}
