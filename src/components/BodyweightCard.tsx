// src/components/BodyweightCard.tsx
// Card peso corporeo: registra il peso di oggi, mostra l'andamento e la
// "forza relativa" (1RM stimato dei lift principali ÷ peso corporeo).

import { useState } from 'react';
import { Scale, Check } from 'lucide-react';
import { useBodyweight } from '../hooks/useBodyweight';
import { useLogStore }   from '../hooks/useLogStore';
import { useProgramData } from '../hooks/useProgramData';
import { Sparkline }     from './Sparkline';
import { exerciseHistory, recordsFromHistory } from '../lib/records';
import { STRENGTH_PRIMARY_IDS } from '../data/character';
import { formatDisplay } from '../lib/dates';

function round1(n: number): number { return Math.round(n * 10) / 10; }

export function BodyweightCard() {
  const { entries, latest, todayKg, setToday } = useBodyweight();
  const { getAllSessionLogs } = useLogStore();
  const program = useProgramData();

  const [val, setVal] = useState<number>(() => todayKg ?? latest?.kg ?? 70);

  const adjust = (delta: number) => setVal(v => Math.max(30, round1(v + delta)));

  // ── Forza relativa sui lift principali ────────────────────────────────────
  const nameById = new Map<string, string>();
  for (const s of program.baseSessions) for (const e of s.exercises) nameById.set(e.id, e.name);
  const allSessions = getAllSessionLogs();
  const relList = latest
    ? STRENGTH_PRIMARY_IDS
        .filter(id => nameById.has(id))
        .map(id => {
          const recs = recordsFromHistory(exerciseHistory(allSessions, id));
          return { id, name: nameById.get(id) ?? id, e1rm: recs.maxE1rm };
        })
        .filter(r => r.e1rm > 0)
        .map(r => ({ ...r, ratio: r.e1rm / latest!.kg }))
    : [];

  const trend = entries.map(e => e.kg);

  return (
    <div className="sl-panel rounded-2xl px-4 py-4 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 sl-label text-[10px] text-[var(--sl-text-dim)]">
          <Scale size={14} className="text-[var(--sl-cyan)]" /> Peso corporeo
        </span>
        {latest && (
          <span className="text-xs text-[var(--sl-text-dim)]">
            ultimo: <span className="text-slate-200 font-semibold tabular-nums">{round1(latest.kg)}</span> kg
            <span className="text-slate-600"> · {formatDisplay(latest.date)}</span>
          </span>
        )}
      </div>

      {/* Registra peso di oggi */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => adjust(-0.5)}
          aria-label="Meno 0,5 kg"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-lg font-bold shrink-0
            text-[var(--sl-cyan-soft)] border border-[var(--sl-line)] bg-[rgba(56,225,255,0.08)] active:bg-[rgba(56,225,255,0.18)]"
        >−</button>
        <input
          type="number"
          inputMode="decimal"
          value={val}
          onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setVal(n); }}
          onBlur={() => setVal(v => Math.max(30, round1(v)))}
          className="w-[84px] text-center text-2xl font-bold tabular-nums
            bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-xl py-1.5 text-white
            focus:outline-none focus:border-[var(--sl-cyan)]
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => adjust(0.5)}
          aria-label="Più 0,5 kg"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-lg font-bold shrink-0
            text-[var(--sl-cyan-soft)] border border-[var(--sl-line)] bg-[rgba(56,225,255,0.08)] active:bg-[rgba(56,225,255,0.18)]"
        >+</button>
        <button
          type="button"
          onClick={() => setToday(round1(val))}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 h-11 rounded-xl
            text-sm font-semibold text-[#06121e] sl-btn"
        >
          <Check size={16} strokeWidth={2.5} />
          {todayKg !== null ? 'Aggiorna oggi' : 'Registra oggi'}
        </button>
      </div>

      {/* Andamento */}
      {trend.length >= 2 && (
        <div className="pt-0.5">
          <Sparkline points={trend} height={32} className="w-full" dot={false} />
        </div>
      )}

      {/* Forza relativa */}
      {relList.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="sl-label text-[10px] text-[var(--sl-text-dim)]">Forza relativa (1RM stim. / peso)</p>
          {relList.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-300 truncate">{r.name}</span>
              <span className="tabular-nums shrink-0">
                <span className="text-white font-bold">{round1(r.ratio)}×</span>
                <span className="text-[var(--sl-text-dim)] text-xs"> peso</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
