// src/hooks/useWakeLock.ts
// Mantiene lo schermo acceso durante l'allenamento (Screen Wake Lock API).

import { useEffect, useRef } from 'react';

/**
 * Tiene lo schermo acceso finché `active` è true.
 * Il lock viene rilasciato automaticamente dal browser quando la pagina passa
 * in background: lo ri-acquisiamo al ritorno in primo piano.
 * No-op silenzioso dove l'API non è supportata (es. iOS < 16.4).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const acquire = async (): Promise<void> => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        /* permesso negato o non disponibile: ignora */
      }
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && sentinelRef.current === null) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
