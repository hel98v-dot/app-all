// src/hooks/useWeeklyQuests.ts
// Quest settimanali — obiettivi della SETTIMANA corrente del mesociclo,
// valutati automaticamente sui log della scheda attiva. Stile RPG: ogni
// quest ha progresso current/target, stato done e una ricompensa in XP.

import { useDeferredValue, useMemo } from 'react';
import { useLogStore }     from './useLogStore';
import { useProgramData }  from './useProgramData';
import { getCurrentWeekNumber } from '../data/program';
import { DEFAULT_SCHEDULE_ID } from '../lib/schedules';
import type { SessionLog } from '../types';

export interface Quest {
  id:      string;
  icon:    string;
  title:   string;
  desc:    string;
  current: number;
  target:  number;
  done:    boolean;
  /** Quest booleana (es. "batti un record"): mostra ✓ invece di n/n. */
  bool?:   boolean;
  xp:      number;
}

export interface WeeklyQuests {
  weekNumber: number;
  quests:     Quest[];
  completed:  number;
  total:      number;
  isStale:    boolean;
}

const VOLUME_BASELINE = 10_000;   // target volume quando non c'è settimana precedente

function sessionVolume(s: SessionLog): number {
  return s.exercises.reduce(
    (acc, ex) => acc + ex.sets.reduce((a, st) => a + st.reps * st.kg, 0), 0,
  );
}

export function useWeeklyQuests(): WeeklyQuests {
  const { store, startDate } = useLogStore();
  const program  = useProgramData();
  const deferred  = useDeferredValue(store.sessions);
  const isStale   = deferred !== store.sessions;

  const activeId    = program.activeScheduleId;
  const muscleMap   = program.getMuscleMap();
  const sessionGoal = program.baseSessions.length;

  return useMemo(() => {
    const weekNumber = getCurrentWeekNumber(startDate, new Date());

    // Log della scheda attiva, separati per settimana corrente / precedente.
    const mine = deferred.filter(s => (s.scheduleId ?? DEFAULT_SCHEDULE_ID) === activeId);
    const week = mine.filter(s => s.weekNumber === weekNumber);
    const prev = mine.filter(s => s.weekNumber === weekNumber - 1);

    // ── 1. Sessioni completate questa settimana ──────────────────────────────
    const doneSessions = new Set(week.filter(s => sessionVolume(s) > 0).map(s => s.sessionId));
    const sessCount = doneSessions.size;

    // ── 2. Volume settimanale vs settimana precedente (o baseline) ───────────
    const weekVol = week.reduce((a, s) => a + sessionVolume(s), 0);
    const prevVol = prev.reduce((a, s) => a + sessionVolume(s), 0);
    const volTarget = prevVol > 0 ? prevVol : VOLUME_BASELINE;

    // ── 3. Esercizi di core (Addome) allenati questa settimana ───────────────
    const coreEx = new Set<string>();
    for (const s of week) {
      for (const ex of s.exercises) {
        if (muscleMap[ex.exerciseId] === 'Addome' && ex.sets.some(st => st.reps > 0)) {
          coreEx.add(ex.exerciseId);
        }
      }
    }

    // ── 4. Giorni distinti di allenamento ────────────────────────────────────
    const trainDays = new Set(week.filter(s => sessionVolume(s) > 0).map(s => s.date));

    // ── 5. Nuovo record di carico: max kg di questa settimana > tutte le prec. ─
    const priorTopKg = new Map<string, number>();   // miglior kg nelle settimane < corrente
    for (const s of mine) {
      if (s.weekNumber >= weekNumber) continue;
      for (const ex of s.exercises) {
        for (const st of ex.sets) {
          if (st.reps > 0 && st.kg > (priorTopKg.get(ex.exerciseId) ?? 0)) {
            priorTopKg.set(ex.exerciseId, st.kg);
          }
        }
      }
    }
    let prs = 0;
    for (const s of week) {
      for (const ex of s.exercises) {
        const prior = priorTopKg.get(ex.exerciseId) ?? 0;
        if (prior <= 0) continue;   // serve un riferimento da battere
        const best = Math.max(0, ...ex.sets.filter(st => st.reps > 0).map(st => st.kg));
        if (best > prior) { prs++; break; }
      }
    }

    const quests: Quest[] = [
      {
        id: 'sessions',
        icon: '⚔️',
        title: 'Completa le sessioni',
        desc: `${sessCount}/${sessionGoal} sessioni della scheda`,
        current: sessCount,
        target: Math.max(1, sessionGoal),
        done: sessCount >= sessionGoal && sessionGoal > 0,
        xp: 100,
      },
      {
        id: 'volume',
        icon: '📦',
        title: prevVol > 0 ? `Supera il volume di S${weekNumber - 1}` : 'Costruisci volume',
        desc: `${Math.round(weekVol).toLocaleString('it-IT')} / ${Math.round(volTarget).toLocaleString('it-IT')} kg`,
        current: weekVol,
        target: volTarget,
        done: weekVol >= volTarget && weekVol > 0,
        xp: 80,
      },
      {
        id: 'core',
        icon: '🛡️',
        title: 'Non saltare il core',
        desc: `${coreEx.size}/2 esercizi addome/anti-movement`,
        current: coreEx.size,
        target: 2,
        done: coreEx.size >= 2,
        xp: 60,
      },
      {
        id: 'frequency',
        icon: '🎯',
        title: 'Costanza',
        desc: `${trainDays.size}/3 giorni di allenamento`,
        current: trainDays.size,
        target: 3,
        done: trainDays.size >= 3,
        xp: 60,
      },
      {
        id: 'pr',
        icon: '🔥',
        title: 'Batti un record',
        desc: prs > 0 ? 'Nuovo carico massimo!' : 'Supera un carico precedente',
        current: prs > 0 ? 1 : 0,
        target: 1,
        done: prs > 0,
        bool: true,
        xp: 120,
      },
    ];

    return {
      weekNumber,
      quests,
      completed: quests.filter(q => q.done).length,
      total: quests.length,
      isStale,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, activeId, startDate, sessionGoal]);
}
