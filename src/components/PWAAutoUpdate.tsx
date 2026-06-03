// src/components/PWAAutoUpdate.tsx
// Aggiornamento automatico della PWA: controlla periodicamente nuovi deploy e,
// quando il nuovo service worker prende il controllo, ricarica la pagina.
// Niente download/reinstall manuale: gli aggiornamenti arrivano da soli.

import { useEffect } from 'react';

export function PWAAutoUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Era già controllata da un SW? Se sì, un cambio di controller = aggiornamento.
    // Al PRIMO install (controller assente) non ricarichiamo, per evitare flash/loop.
    const wasControlled = navigator.serviceWorker.controller != null;
    let refreshing = false;

    const onControllerChange = (): void => {
      if (refreshing) return;
      refreshing = true;
      if (wasControlled) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const check = (): void => {
      navigator.serviceWorker.getRegistration()
        .then(reg => { void reg?.update(); })
        .catch(() => {});
    };

    const interval = window.setInterval(check, 60_000); // ogni minuto
    const onVisible = (): void => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    check();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
