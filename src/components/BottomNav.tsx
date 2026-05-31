// src/components/BottomNav.tsx
// Dock di navigazione "System" — vetro scuro, voce attiva con glow cyan.
import { NavLink } from 'react-router-dom';
import { Swords, ScrollText, BarChart3, ShieldHalf, Cpu } from 'lucide-react';

interface Tab {
  to: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const TABS: Tab[] = [
  { to: '/',             label: 'Missione', Icon: Swords     },
  { to: '/storico',      label: 'Registro', Icon: ScrollText },
  { to: '/volume',       label: 'Volume',   Icon: BarChart3  },
  { to: '/personaggio',  label: 'Status',   Icon: ShieldHalf },
  { to: '/impostazioni', label: 'Sistema',  Icon: Cpu        },
];

export function BottomNav() {
  return (
    <nav
      className="shrink-0 relative z-10 border-t border-[var(--sl-line)]
        bg-[rgba(6,10,20,0.82)] backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Linea luminosa superiore */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--sl-cyan)] to-transparent opacity-60" />

      <ul className="flex">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => [
                'flex flex-col items-center justify-center gap-1',
                'py-3 w-full min-h-[58px] relative transition-colors duration-150 select-none',
                'sl-label text-[9px]',
                isActive ? 'text-[var(--sl-cyan-soft)]' : 'text-[var(--sl-text-dim)] active:text-slate-300',
              ].join(' ')}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[var(--sl-cyan)] shadow-[0_0_10px_var(--sl-glow)]" />
                  )}
                  <Icon
                    size={23}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    className={isActive ? 'drop-shadow-[0_0_6px_var(--sl-glow)]' : ''}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
