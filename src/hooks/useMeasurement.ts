// src/hooks/useMeasurement.ts
// Tracciamento generico di una misura corporea nel tempo (peso, vita, …),
// persistito per profilo. Una voce al giorno. Migra il vecchio campo `kg`.

import { useCallback, useState } from 'react';
import { today } from '../lib/dates';

export interface MeasEntry {
  date: string; // YYYY-MM-DD
  value: number;
}

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

function keyFor(name: string): string {
  return `${name}-v1-${getActiveProfileId()}`;
}

function read(key: string): MeasEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as Array<{ date?: unknown; value?: unknown; kg?: unknown }>)
        .map(e => ({
          date: typeof e.date === 'string' ? e.date : '',
          value: typeof e.value === 'number' ? e.value : (typeof e.kg === 'number' ? e.kg : NaN),
        }))
        .filter(e => e.date !== '' && !Number.isNaN(e.value))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch { /* ignore */ }
  return [];
}

function write(key: string, list: MeasEntry[]): void {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
}

export interface UseMeasurementReturn {
  entries: MeasEntry[];
  latest: MeasEntry | null;
  todayValue: number | null;
  setToday: (value: number) => void;
  remove: (date: string) => void;
}

export function useMeasurement(name: string): UseMeasurementReturn {
  const key = keyFor(name);
  const [entries, setEntries] = useState<MeasEntry[]>(() => read(key));

  const setToday = useCallback((value: number) => {
    if (!(value > 0)) return;
    const d = today();
    const next = [...entries.filter(e => e.date !== d), { date: d, value }]
      .sort((a, b) => a.date.localeCompare(b.date));
    write(key, next);
    setEntries(next);
  }, [entries, key]);

  const remove = useCallback((date: string) => {
    const next = entries.filter(e => e.date !== date);
    write(key, next);
    setEntries(next);
  }, [entries, key]);

  const latest = entries.length ? entries[entries.length - 1]! : null;
  const todayValue = entries.find(e => e.date === today())?.value ?? null;

  return { entries, latest, todayValue, setToday, remove };
}
