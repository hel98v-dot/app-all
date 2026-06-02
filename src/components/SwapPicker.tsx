// src/components/SwapPicker.tsx
// Bottom-sheet per sostituire un esercizio "al volo" (es. macchina occupata).
// Elenca gli altri esercizi del programma, con lo stesso gruppo muscolare in cima.

import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Repeat2 } from 'lucide-react';
import type { Exercise, Muscle } from '../data/program';

interface SwapPickerProps {
  current:         Exercise;     // esercizio attualmente mostrato (originale o sostituto)
  priorityMuscle:  Muscle;       // gruppo muscolare da mostrare per primo
  candidates:      Exercise[];   // esercizi unici del programma
  isSwapped:       boolean;
  onPick:          (exerciseId: string) => void;
  onRevert:        () => void;
  onClose:         () => void;
}

export function SwapPicker({
  current, priorityMuscle, candidates, isSwapped, onPick, onRevert, onClose,
}: SwapPickerProps) {

  const groups = useMemo(() => {
    const byMuscle = new Map<Muscle, Exercise[]>();
    for (const ex of candidates) {
      if (ex.id === current.id) continue;
      const arr = byMuscle.get(ex.muscle) ?? [];
      arr.push(ex);
      byMuscle.set(ex.muscle, arr);
    }
    const muscles = [...byMuscle.keys()].sort((a, b) => {
      if (a === priorityMuscle) return -1;
      if (b === priorityMuscle) return 1;
      return a.localeCompare(b);
    });
    return muscles.map(m => ({ muscle: m, items: byMuscle.get(m) ?? [] }));
  }, [candidates, current.id, priorityMuscle]);

  // Portale su document.body: fuori dal contenitore di route (che ha un
  // transform da animazione e romperebbe `position: fixed`).
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      {/* Sheet */}
      <div className="relative sl-panel sl-topline rounded-t-3xl max-h-[80vh] flex flex-col
        max-w-lg w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Repeat2 size={18} className="text-[var(--sl-cyan)] shrink-0" />
            <div className="min-w-0">
              <p className="sl-label text-[10px] text-[var(--sl-text-dim)]">Sostituisci</p>
              <p className="text-slate-100 font-semibold truncate">{current.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0
              text-slate-300 border border-[var(--sl-line-soft)] bg-[rgba(255,255,255,0.04)]
              active:bg-[rgba(255,255,255,0.1)]"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Ripristina originale */}
        {isSwapped && (
          <div className="px-4 pb-2 shrink-0">
            <button
              type="button"
              onClick={onRevert}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl min-h-[44px]
                text-amber-300 text-sm font-semibold
                border border-amber-600/40 bg-amber-500/10 active:bg-amber-500/20"
            >
              <RotateCcw size={15} strokeWidth={2.25} />
              Ripristina esercizio originale
            </button>
          </div>
        )}

        {/* Lista */}
        <div className="overflow-y-auto overscroll-contain px-4 pb-6 space-y-4">
          {groups.map(({ muscle, items }) => (
            <div key={muscle} className="space-y-1.5">
              <p className={[
                'sl-label text-[10px] sticky top-0 py-1',
                muscle === priorityMuscle ? 'text-[var(--sl-cyan)]' : 'text-[var(--sl-text-dim)]',
              ].join(' ')}>
                {muscle}{muscle === priorityMuscle ? ' · stesso gruppo' : ''}
              </p>
              {items.map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onPick(ex.id)}
                  className="w-full text-left rounded-xl px-3 py-3 min-h-[48px] flex items-center gap-2
                    border border-[var(--sl-line-soft)] bg-[rgba(56,225,255,0.04)]
                    active:bg-[rgba(56,225,255,0.12)]"
                >
                  <span className="flex-1 text-slate-100 text-sm font-medium leading-snug">
                    {ex.name}
                    {ex.unilateral && <span className="text-slate-500 font-normal"> (per lato)</span>}
                  </span>
                  <span className="text-[11px] text-[var(--sl-text-dim)] tabular-nums shrink-0">
                    {ex.prescribedSets}×{ex.repsTarget}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
