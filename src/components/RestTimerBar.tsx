// src/components/RestTimerBar.tsx
// Barra fluttuante del timer di recupero, mostrata sopra la BottomNav.
// Visibile solo quando il timer è attivo o appena concluso.

import { Timer, Plus, Minus, X, Check } from 'lucide-react';
import { useRestTimer } from '../hooks/useRestTimer';
import { formatClock } from '../lib/restTime';

export function RestTimerBar() {
  const { running, finished, remaining, total, label, add, stop } = useRestTimer();

  if (!running && !finished) return null;

  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <div className="px-3 pt-1 pb-1.5 relative z-20">
      <div
        className={[
          'sl-panel rounded-2xl px-3 py-2',
          finished ? 'ring-1 ring-[var(--sl-cyan)] sl-pulse' : '',
        ].join(' ')}
      >
        <div className="flex items-center gap-3">
          {/* Icona + testo */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={['shrink-0', finished ? 'text-[var(--sl-cyan-soft)]' : 'text-[var(--sl-cyan)]'].join(' ')}>
              {finished ? <Check size={20} strokeWidth={2.5} /> : <Timer size={20} strokeWidth={2} />}
            </span>
            <div className="min-w-0">
              <p className="sl-label text-[9px] text-[var(--sl-text-dim)] leading-none truncate">
                {finished ? 'Recupero finito' : 'Recupero'}
                {label ? ` · ${label}` : ''}
              </p>
              <p className={[
                'text-2xl font-bold tabular-nums leading-tight sl-display',
                finished ? 'text-[var(--sl-cyan-soft)]' : 'text-white',
              ].join(' ')}>
                {formatClock(remaining)}
              </p>
            </div>
          </div>

          {/* Controlli */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => add(-15)}
              aria-label="Meno 15 secondi"
              className="flex items-center justify-center w-11 h-11 rounded-xl text-[var(--sl-cyan-soft)]
                border border-[var(--sl-line)] bg-[rgba(56,225,255,0.06)] active:bg-[rgba(56,225,255,0.16)]
                text-xs font-bold gap-0.5"
            >
              <Minus size={13} strokeWidth={3} />15
            </button>
            <button
              type="button"
              onClick={() => add(15)}
              aria-label="Più 15 secondi"
              className="flex items-center justify-center w-11 h-11 rounded-xl text-[var(--sl-cyan-soft)]
                border border-[var(--sl-line)] bg-[rgba(56,225,255,0.06)] active:bg-[rgba(56,225,255,0.16)]
                text-xs font-bold gap-0.5"
            >
              <Plus size={13} strokeWidth={3} />15
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label={finished ? 'Chiudi' : 'Salta recupero'}
              className="flex items-center justify-center w-11 h-11 rounded-xl text-slate-300
                border border-[var(--sl-line-soft)] bg-[rgba(255,255,255,0.04)] active:bg-[rgba(255,255,255,0.1)]"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Barra di avanzamento */}
        {!finished && (
          <div className="mt-1.5 h-1 rounded-full bg-[rgba(6,10,20,0.7)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--sl-cyan)] shadow-[0_0_8px_var(--sl-glow)] transition-[width] duration-300 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
