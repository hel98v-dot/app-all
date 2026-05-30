// src/components/BottomNav.tsx
// Navigazione inferiore fissa. Touch target minimo 56px (py garantisce l'altezza).
import { NavLink } from 'react-router-dom';
import { Dumbbell, Clock, BarChart3, User, Settings } from 'lucide-react';

interface Tab {
  to: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const TABS: Tab[] = [
  { to: '/',             label: 'Oggi',        Icon: Dumbbell  },
  { to: '/storico',      label: 'Storico',     Icon: Clock     },
  { to: '/volume',       label: 'Volume',      Icon: BarChart3 },
  { to: '/personaggio',  label: 'Personaggio', Icon: User      },
  { to: '/impostazioni', label: 'Impostazioni',Icon: Settings  },
];

export function BottomNav() {
  return (
    <nav
      className="shrink-0 bg-slate-900 border-t border-slate-800 safe-area-pb"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => [
                // Altezza minima 56px: py-3.5 (28px) × 2 = 56px + contenuto
                'flex flex-col items-center justify-center gap-1',
                'py-3.5 w-full min-h-[56px]',
                'text-[10px] font-semibold uppercase tracking-wide',
                'transition-colors duration-150 select-none',
                isActive
                  ? 'text-indigo-400'
                  : 'text-slate-500 active:text-slate-300',
              ].join(' ')}
            >
              <Icon size={24} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
