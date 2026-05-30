// src/components/Layout.tsx
// Contenitore full-height con area scrollabile + BottomNav fissa.
// Transizione 200ms fade+slide al cambio route tramite key su location.pathname.
import { useLocation, Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Scroll container con animazione al cambio route */}
      <div
        key={location.pathname}
        className="flex-1 overflow-y-auto overscroll-contain route-enter"
      >
        <Outlet />
      </div>

      <BottomNav />
    </div>
  );
}
