// src/hooks/useCurrentSession.ts
// Calcola settimana e giorno correnti — usato come default per i selettori in Today.

import { useMemo }           from 'react';
import { getCurrentWeekNumber, getDayKeyFromDate, type DayKey } from '../data/program';
import { today }             from '../lib/dates';

export interface CurrentDefaults {
  /** Settimana mesociclo calcolata da startDate (1-5). */
  weekNumber: number;
  /** Chiave giorno corrente ("lunedi", "sabato", …). */
  dayKey:     DayKey;
  /** Data odierna YYYY-MM-DD. */
  dateISO:    string;
}

export function useCurrentSession(startDate: string): CurrentDefaults {
  return useMemo(() => {
    const now        = new Date();
    const dateISO    = today();
    const weekNumber = getCurrentWeekNumber(startDate, now);
    const dayKey     = getDayKeyFromDate(now);
    return { weekNumber, dayKey, dateISO };
  }, [startDate]);
}
