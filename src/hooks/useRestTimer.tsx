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

/** Avviso sonoro "forte ma breve": doppio bip square (~0.35s). */
function beep(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);   // forte
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.18);   // secondo colpo
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); // breve
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.type = 'square';                       // timbro incisivo
    osc.frequency.setValueAtTime(988, t);      // Si
    osc.frequency.setValueAtTime(1319, t + 0.17); // Mi → "di-dah"
    osc.start(t);
    osc.stop(t + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio non disponibile: ignora */
  }
}

/** Notifica di sistema a fine recupero (best-effort; via SW per Android/PWA). */
function notifyRestDone(label: string): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const title = 'Recupero finito 💪';
    const options = {
      body: label ? `${label} — pronto per la prossima serie` : 'Pronto per la prossima serie',
      tag: 'rest-timer',
      renotify: true,
      vibrate: [200, 80, 200],
      silent: false,
    };
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, options))
        .catch(() => { try { new Notification(title, options); } catch { /* ignore */ } });
    } else {
      new Notification(title, options);
    }
  } catch {
    /* notifiche non disponibili: ignora */
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestTimerState>(INITIAL);
  const endsAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const labelRef = useRef<string>('');

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
      notifyRestDone(labelRef.current);
    } else {
      setState(s => ({ ...s, remaining: Math.ceil(remainingMs / 1000) }));
    }
  }, [clearTick]);

  const start = useCallback((seconds: number, label = ''): void => {
    // Chiedi il permesso notifiche al primo avvio (siamo in un gesto utente).
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch { /* ignore */ }
    labelRef.current = label;
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
