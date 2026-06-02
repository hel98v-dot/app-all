// src/hooks/useAutoRest.ts
// Debounce per l'avvio automatico del recupero: programma un'azione e la
// ri-rimanda se arrivano altre modifiche (così il timer parte solo quando
// l'utente smette di regolare le reps, non al primo tocco).

import { useCallback, useEffect, useRef } from 'react';

export interface AutoRest {
  schedule: (fn: () => void, delay?: number) => void;
  cancel:   () => void;
}

export function useAutoRest(): AutoRest {
  const timeoutRef = useRef<number | null>(null);

  const cancel = useCallback((): void => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const schedule = useCallback((fn: () => void, delay = 1300): void => {
    cancel();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      fn();
    }, delay);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
}
