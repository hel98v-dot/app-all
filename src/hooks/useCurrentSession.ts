// src/hooks/useCurrentSession.ts
import { useMemo }           from 'react';
import { getCurrentWeekNumber, type DayKey } from '../data/program';
import { useProgramData }    from './useProgramData';
import { today }             from '../lib/dates';

export interface CurrentDefaults {
  weekNumber: number;
  dayKey:     DayKey;
  dateISO:    string;
}

export function useCurrentSession(startDate: string): CurrentDefaults {
  const program = useProgramData();
  return useMemo(() => {
    const now        = new Date();
    const dateISO    = today();
    const weekNumber = getCurrentWeekNumber(startDate, now);
    const dayKey     = program.getDayKey();
    return { weekNumber, dayKey, dateISO };
  }, [startDate, program]);
}
