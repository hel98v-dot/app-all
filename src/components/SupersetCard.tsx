// src/components/SupersetCard.tsx
// Card combinata di un superset nella schermata Oggi: mostra i due esercizi,
// progresso unificato e apre il logger combinato. Azione per sciogliere la coppia.

import { ChevronRight, Link2, Unlink, CheckCircle2 } from 'lucide-react';
import type { Exercise } from '../data/program';
import type { ExerciseLog } from '../types';

interface SupersetCardProps {
  a:        Exercise;
  b:        Exercise;
  logA:     ExerciseLog | undefined;
  logB:     ExerciseLog | undefined;
  onClick:  () => void;
  onUnpair: () => void;
}

function doneSets(log: ExerciseLog | undefined): number {
  return log?.sets.filter(s => s.reps > 0).length ?? 0;
}

export function SupersetCard({ a, b, logA, logB, onClick, onUnpair }: SupersetCardProps) {
  const total = a.prescribedSets + b.prescribedSets;
  const done  = Math.min(doneSets(logA), a.prescribedSets) + Math.min(doneSets(logB), b.prescribedSets);
  const isDone = done >= total && total > 0;

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={[
          'w-full text-left rounded-2xl px-4 py-4 flex items-stretch gap-3 pr-14',
          'transition-all active:scale-[0.985] active:brightness-110',
          isDone
            ? 'border bg-emerald-950/45 border-emerald-600/50 shadow-[0_0_16px_rgba(16,185,129,0.12)]'
            : 'sl-panel',
        ].join(' ')}
      >
        {/* Spina superset a sinistra */}
        <div className="flex flex-col items-center justify-center shrink-0 pr-1">
          <Link2 size={22} className={isDone ? 'text-emerald-400' : 'text-[var(--sl-violet-soft)]'} strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <span className="sl-label text-[9px] text-[var(--sl-violet-soft)]">▦ Superset</span>

          <div className="space-y-1">
            <p className="text-[15px] font-bold leading-snug text-slate-50 truncate">{a.name}</p>
            <p className="text-[15px] font-bold leading-snug text-slate-50 truncate">
              <span className="text-[var(--sl-text-dim)] font-normal">+ </span>{b.name}
            </p>
          </div>

          <p className="text-xs text-slate-500">
            {a.prescribedSets}×{a.repsTarget} · {b.prescribedSets}×{b.repsTarget} — a serie alternate
          </p>
        </div>

        {/* Progresso + freccia */}
        <div className="shrink-0 flex flex-col items-end justify-between self-stretch">
          {done > 0 && (
            isDone
              ? <CheckCircle2 size={22} className="text-emerald-400" strokeWidth={2} />
              : <span className="text-[15px] font-bold tabular-nums text-[var(--sl-violet-soft)]">{done}/{total}</span>
          )}
          <ChevronRight size={20} strokeWidth={2} className={isDone ? 'text-emerald-600' : 'text-slate-600'} />
        </div>
      </button>

      {/* Sciogli superset */}
      <button
        onClick={e => { e.stopPropagation(); onUnpair(); }}
        aria-label="Sciogli superset"
        className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-xl
          text-slate-400 border border-[var(--sl-line-soft)] bg-[rgba(255,255,255,0.04)]
          active:bg-amber-800 active:text-amber-200"
      >
        <Unlink size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
