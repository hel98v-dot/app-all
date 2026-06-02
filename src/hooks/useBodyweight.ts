// src/hooks/useBodyweight.ts
// Tracciamento del peso corporeo nel tempo, persistito per profilo.

import { useCallback, useState } from 'react';
import { today } from '../lib/dates';

export interface BWEntry {
  date: string; // YYYY-MM-DD
  kg: number;
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

const STORAGE_KEY = `bodyweight-v1-${getActiveProfileId()}`;

function read(): BWEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as BWEntry[])
        .filter(e => typeof e?.date === 'string' && typeof e?.kg === 'number')
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch { /* ignore */ }
  return [];
}

function write(list: BWEntry[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export interface UseBodyweightReturn {
  entries: BWEntry[];
  latest: BWEntry | null;
  todayKg: number | null;
  setToday: (kg: number) => void;
  removeToday: () => void;
}

export function useBodyweight(): UseBodyweightReturn {
  const [entries, setEntries] = useState<BWEntry[]>(read);

  const setToday = useCallback((kg: number) => {
    if (!(kg > 0)) return;
    const d = today();
    const next = [...entries.filter(e => e.date !== d), { date: d, kg }]
      .sort((a, b) => a.date.localeCompare(b.date));
    write(next);
    setEntries(next);
  }, [entries]);

  const removeToday = useCallback(() => {
    const d = today();
    const next = entries.filter(e => e.date !== d);
    write(next);
    setEntries(next);
  }, [entries]);

  const latest = entries.length ? entries[entries.length - 1]! : null;
  const todayKg = entries.find(e => e.date === today())?.kg ?? null;

  return { entries, latest, todayKg, setToday, removeToday };
}
