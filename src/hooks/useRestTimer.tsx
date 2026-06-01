/* eslint-disable react-refresh/only-export-components */
// src/hooks/useRestTimer.tsx
// Timer di recupero globale: lo stato vive sopra il router, così il countdown
// continua anche tornando dalla schermata esercizio alla sessione.

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';

interface RestTimerState {
  running: boolean;
  finished: boolean;  // true nell'istante in cui arriva a 0 (per UI/segnale)
  remaining: number;  // secondi rimanenti (>= 0)
  total: number;      // durata impostata all'avvio
  label: string;      // es. nome esercizio
}

export interface RestTimerApi extends RestTimerState {
  start: (seconds: number, label?: string) => void;
  add: (deltaSeconds: number) => void;
  stop: () => void;
}

const RestTimerContext = createContext<RestTimerApi | null>(null);

const INITIAL: RestTimerState = {
  running: false, finished: false, remaining: 0, total: 0, label: '',
};

/** Beep breve generato via Web Audio (nessun asset). */
function beep(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.start(t);
    osc.stop(t + 0.55);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio non disponibile: ignora */
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(INITIAL);
  const endsAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  const clearTick = useCallback((): void => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback((): void => {
    const remainingMs = endsAtRef.current - Date.now();
    if (remainingMs <= 0) {
      clearTick();
      setState(s => ({ ...s, running: false, finished: true, remaining: 0 }));
      if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
      beep();
    } else {
      setState(s => ({ ...s, remaining: Math.ceil(remainingMs / 1000) }));
    }
  }, [clearTick]);

  const start = useCallback((seconds: number, label = ''): void => {
    clearTick();
    endsAtRef.current = Date.now() + seconds * 1000;
    setState({ running: true, finished: false, remaining: seconds, total: seconds, label });
    intervalRef.current = window.setInterval(tick, 250);
  }, [clearTick, tick]);

  const add = useCallback((deltaSeconds: number): void => {
    const base = endsAtRef.current > Date.now() ? endsAtRef.current : Date.now();
    endsAtRef.current = base + deltaSeconds * 1000;
    const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
    clearTick();
    if (remaining > 0) intervalRef.current = window.setInterval(tick, 250);
    setState(s => ({
      ...s,
      running: remaining > 0,
      finished: false,
      remaining,
      total: Math.max(s.total, remaining),
    }));
  }, [clearTick, tick]);

  const stop = useCallback((): void => {
    clearTick();
    endsAtRef.current = 0;
    setState(INITIAL);
  }, [clearTick]);

  // Pulizia all'unmount del provider
  useEffect(() => () => clearTick(), [clearTick]);

  return (
    <RestTimerContext.Provider value={{ ...state, start, add, stop }}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer(): RestTimerApi {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer deve essere usato dentro <RestTimerProvider>');
  return ctx;
}
