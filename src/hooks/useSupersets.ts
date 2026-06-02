// src/hooks/useSupersets.ts
// Superset "al volo": abbina due esercizi di una sessione in una coppia,
// persistita per profilo e indicizzata per (settimana, sessione).
// Le coppie usano gli id "effettivi" (post-sostituzione) mostrati su Oggi.

import { useCallback, useState } from 'react';
import type { Session } from '../data/program';

type Pair = [string, string];
type PairMap = Record<string, Pair[]>; // `${week}:${sid}` -> coppie

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

const STORAGE_KEY = `training-supersets-v1-${getActiveProfileId()}`;

function read(): PairMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as PairMap;
  } catch { /* ignore */ }
  return {};
}

function write(map: PairMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function keyOf(weekNumber: number, sessionId: string): string {
  return `${weekNumber}:${sessionId}`;
}

/**
 * Rigenera le coppie superset dai marcatori `supersetGroup` del programma
 * (impostati dalla scheda Excel). Esercizi della stessa sessione con lo stesso
 * valore vengono abbinati. Applica le stesse coppie a tutte le 5 settimane.
 * Sovrascrive le coppie esistenti del profilo (chiamata all'import della scheda).
 */
export function seedSupersetsFromProgram(sessions: Session[]): void {
  const map: PairMap = {};
  for (const s of sessions) {
    const groups = new Map<string, string[]>();
    for (const ex of s.exercises) {
      if (ex.supersetGroup) {
        const arr = groups.get(ex.supersetGroup) ?? [];
        arr.push(ex.id);
        groups.set(ex.supersetGroup, arr);
      }
    }
    const pairs: Pair[] = [];
    for (const ids of groups.values()) {
      for (let i = 0; i + 1 < ids.length; i += 2) {
        pairs.push([ids[i]!, ids[i + 1]!]);
      }
    }
    if (pairs.length) {
      for (let wk = 1; wk <= 5; wk++) {
        map[keyOf(wk, s.id)] = pairs.map(p => [p[0], p[1]] as Pair);
      }
    }
  }
  write(map);
}

export interface UseSupersetsReturn {
  partnerOf: (weekNumber: number, sessionId: string, exerciseId: string) => string | null;
  setPair:   (weekNumber: number, sessionId: string, a: string, b: string) => void;
  removePairOf: (weekNumber: number, sessionId: string, exerciseId: string) => void;
}

export function useSupersets(): UseSupersetsReturn {
  const [map, setMap] = useState<PairMap>(read);

  const partnerOf = useCallback(
    (weekNumber: number, sessionId: string, exerciseId: string): string | null => {
      const pairs = map[keyOf(weekNumber, sessionId)] ?? [];
      for (const [a, b] of pairs) {
        if (a === exerciseId) return b;
        if (b === exerciseId) return a;
      }
      return null;
    },
    [map],
  );

  const setPair = useCallback(
    (weekNumber: number, sessionId: string, a: string, b: string): void => {
      if (a === b) return;
      const key = keyOf(weekNumber, sessionId);
      // togli eventuali coppie preesistenti che coinvolgono a o b, poi aggiungi
      const kept = (map[key] ?? []).filter(([x, y]) => x !== a && y !== a && x !== b && y !== b);
      const next = { ...map, [key]: [...kept, [a, b] as Pair] };
      write(next);
      setMap(next);
    },
    [map],
  );

  const removePairOf = useCallback(
    (weekNumber: number, sessionId: string, exerciseId: string): void => {
      const key = keyOf(weekNumber, sessionId);
      const pairs = map[key] ?? [];
      const next = { ...map, [key]: pairs.filter(([a, b]) => a !== exerciseId && b !== exerciseId) };
      write(next);
      setMap(next);
    },
    [map],
  );

  return { partnerOf, setPair, removePairOf };
}
