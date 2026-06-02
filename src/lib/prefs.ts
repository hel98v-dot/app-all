// src/lib/prefs.ts
// Preferenze applicative globali (non per-profilo) persistite su localStorage.

import { useCallback, useState } from 'react';

export interface AppPrefs {
  /** Avvia il recupero in automatico dopo aver inserito le reps di una serie. */
  autoRest: boolean;
}

const DEFAULTS: AppPrefs = {
  autoRest: true,
};

const KEY = 'app-prefs-v1';

function readPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppPrefs>) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function writePrefs(p: AppPrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Hook a una singola preferenza: ritorna [valore, setter]. */
export function usePref<K extends keyof AppPrefs>(key: K): [AppPrefs[K], (v: AppPrefs[K]) => void] {
  const [val, setVal] = useState<AppPrefs[K]>(() => readPrefs()[key]);
  const set = useCallback((v: AppPrefs[K]) => {
    setVal(v);
    writePrefs({ ...readPrefs(), [key]: v });
  }, [key]);
  return [val, set];
}
