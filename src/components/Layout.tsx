// src/components/Layout.tsx
// Contenitore full-height + BottomNav fissa, con sfondo "System" dietro a tutto.
// Lo sfondo cambia in base alla route (e all'esercizio aperto).
import { useLocation, Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { ThemeBackground } from './ThemeBackground';

/** Chiavi sfondo in ordine di priorità per la route corrente. */
function bgKeysFor(pathname: string): string[] {
  if (pathname.startsWith('/esercizio/')) {
    // /esercizio/:week/:session/:exerciseId
    const exId = pathname.split('/')[4] ?? '';
    return [`exercise:${exId}`, 'exercise-default', 'global'];
  }
  const map: Record<string, string> = {
    '/':             'page:today',
    '/storico':      'page:history',
    '/volume':       'page:volume',
    '/personaggio':  'page:character',
    '/impostazioni': 'page:settings',
  };
  const key = map[pathname];
  return key ? [key, 'global'] : ['global'];
}

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] text-slate-100 overflow-hidden">
      {/* Sfondo full-screen (z -10) */}
      <ThemeBackground keys={bgKeysFor(location.pathname)} />

      {/* Scroll container con animazione al cambio route */}
      <div
        key={location.pathname}
        className="flex-1 overflow-y-auto overscroll-contain route-enter relative z-0"
      >
        <Outlet />
      </div>

      <BottomNav />
    </div>
  );
}
