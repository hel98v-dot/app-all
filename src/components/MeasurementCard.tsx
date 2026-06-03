// src/components/MeasurementCard.tsx
// Card generica per una misura corporea: registra il valore di oggi, mostra
// l'andamento (sparkline) e lo storico (con eliminazione). Opzionalmente
// rende contenuto extra (es. forza relativa per il peso).

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useMeasurement, type MeasEntry } from '../hooks/useMeasurement';
import { Sparkline } from './Sparkline';
import { formatDisplay } from '../lib/dates';

function round1(n: number): number { return Math.round(n * 10) / 10; }

interface MeasurementCardProps {
  storageName: string;
  title: string;
  unit: string;
  step: number;
  min: number;
  icon: ReactNode;
  defaultValue?: number;
  renderExtra?: (latest: MeasEntry | null) => ReactNode;
}

export function MeasurementCard({
  storageName, title, unit, step, min, icon, defaultValue = 70, renderExtra,
}: MeasurementCardProps) {
  const { entries, latest, todayValue, setToday, remove } = useMeasurement(storageName);
  const [val, setVal] = useState<number>(() => todayValue ?? latest?.value ?? defaultValue);
  const [showHistory, setShowHistory] = useState(false);

  const adjust = (delta: number) => setVal(v => Math.max(min, round1(v + delta)));

  const deltaByDate = new Map<string, number | null>();
  entries.forEach((e, i) => deltaByDate.set(e.date, i > 0 ? round1(e.value - entries[i - 1]!.value) : null));

  const trend = entries.map(e => e.value);
  const btn = 'w-11 h-11 flex items-center justify-center rounded-xl text-lg font-bold shrink-0 text-[var(--sl-cyan-soft)] border border-[var(--sl-line)] bg-[rgba(56,225,255,0.08)] active:bg-[rgba(56,225,255,0.18)]';

  return (
    <div className="sl-panel rounded-2xl px-4 py-4 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 sl-label text-[10px] text-[var(--sl-text-dim)]">
          {icon} {title}
        </span>
        {latest && (
          <span className="text-xs text-[var(--sl-text-dim)]">
            ultimo: <span className="text-slate-200 font-semibold tabular-nums">{round1(latest.value)}</span> {unit}
            <span className="text-slate-600"> · {formatDisplay(latest.date)}</span>
          </span>
        )}
      </div>

      {/* Registra valore di oggi */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => adjust(-step)} aria-label={`Meno ${step}`} className={btn}>−</button>
        <input
          type="number"
          inputMode="decimal"
          value={val}
          onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setVal(n); }}
          onBlur={() => setVal(v => Math.max(min, round1(v)))}
          className="w-[84px] text-center text-2xl font-bold tabular-nums
            bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-xl py-1.5 text-white
            focus:outline-none focus:border-[var(--sl-cyan)]
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" onClick={() => adjust(step)} aria-label={`Più ${step}`} className={btn}>+</button>
        <button
          type="button"
          onClick={() => setToday(round1(val))}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 h-11 rounded-xl text-sm font-semibold text-[#06121e] sl-btn"
        >
          <Check size={16} strokeWidth={2.5} />
          {todayValue !== null ? 'Aggiorna oggi' : 'Registra oggi'}
        </button>
      </div>

      {/* Andamento */}
      {trend.length >= 2 && (
        <div className="pt-0.5">
          <Sparkline points={trend} height={32} className="w-full" dot={false} />
        </div>
      )}

      {/* Extra (es. forza relativa) */}
      {renderExtra?.(latest)}

      {/* Storico */}
      {entries.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[var(--sl-text-dim)] active:text-slate-200 py-1"
          >
            <span className="sl-label text-[10px]">Storico ({entries.length})</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showHistory && (
            <div className="mt-1 max-h-60 overflow-y-auto overscroll-contain">
              {[...entries].reverse().map(e => {
                const d = deltaByDate.get(e.date);
                return (
                  <div
                    key={e.date}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--sl-line-soft)] last:border-0"
                  >
                    <span className="text-sm text-slate-400">{formatDisplay(e.date)}</span>
                    <span className="flex items-center gap-2.5">
                      <span className="text-sm text-white font-semibold tabular-nums">{round1(e.value)} {unit}</span>
                      {typeof d === 'number' && d !== 0 && (
                        <span className="text-[11px] tabular-nums text-[var(--sl-text-dim)] w-10 text-right">
                          {d > 0 ? '+' : ''}{d}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(e.date)}
                        aria-label={`Elimina ${e.date}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:text-rose-300 active:bg-rose-900/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
