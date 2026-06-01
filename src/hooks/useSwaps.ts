// src/hooks/useSwaps.ts
// Sostituzioni esercizio "al volo" (es. macchina occupata in palestra).
// Persistite per profilo, indicizzate per (settimana, sessione, esercizio originale).
// NON modificano il programma statico: mappano solo uno slot su un esercizio
// alternativo già presente nel programma.

import { useCallback, useState } from 'react';

type SwapMap = Record<string, string>; // chiave → exerciseId sostituto

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

const STORAGE_KEY = `training-swaps-v1-${getActiveProfileId()}`;

function read(): SwapMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as SwapMap;
  } catch { /* ignore */ }
  return {};
}

function write(map: SwapMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function makeKey(weekNumber: number, sessionId: string, originalId: string): string {
  return `${weekNumber}:${sessionId}:${originalId}`;
}

export interface UseSwapsReturn {
  getSwap: (weekNumber: number, sessionId: string, originalId: string) => string | undefined;
  setSwap: (weekNumber: number, sessionId: string, originalId: string, substituteId: string) => void;
  clearSwap: (weekNumber: number, sessionId: string, originalId: string) => void;
}

export function useSwaps(): UseSwapsReturn {
  const [map, setMap] = useState<SwapMap>(read);

  const getSwap = useCallback(
    (weekNumber: number, sessionId: string, originalId: string): string | undefined =>
      map[makeKey(weekNumber, sessionId, originalId)],
    [map],
  );

  const setSwap = useCallback(
    (weekNumber: number, sessionId: string, originalId: string, substituteId: string): void => {
      const next = { ...map, [makeKey(weekNumber, sessionId, originalId)]: substituteId };
      write(next);
      setMap(next);
    },
    [map],
  );

  const clearSwap = useCallback(
    (weekNumber: number, sessionId: string, originalId: string): void => {
      const key = makeKey(weekNumber, sessionId, originalId);
      if (!(key in map)) return;
      const next = { ...map };
      delete next[key];
      write(next);
      setMap(next);
    },
    [map],
  );

  return { getSwap, setSwap, clearSwap };
}
