// src/components/SupersetPicker.tsx
// Bottom-sheet per abbinare un esercizio a un altro della stessa sessione,
// formando un superset. Reso in portal (come SwapPicker).

import { createPortal } from 'react-dom';
import { X, Link2, Unlink } from 'lucide-react';
import type { Exercise } from '../data/program';

interface SupersetPickerProps {
  current:      Exercise;       // esercizio da abbinare
  candidates:   Exercise[];     // altri esercizi della sessione (id effettivi)
  partnerId:    string | null;  // compagno attuale, se già in superset
  onPick:       (exerciseId: string) => void;
  onRemove:     () => void;
  onClose:      () => void;
}

export function SupersetPicker({
  current, candidates, partnerId, onPick, onRemove, onClose,
}: SupersetPickerProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/70" />

      <div className="relative sl-panel sl-topline rounded-t-3xl max-h-[80vh] flex flex-col max-w-lg w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 size={18} className="text-[var(--sl-violet-soft)] shrink-0" />
            <div className="min-w-0">
              <p className="sl-label text-[10px] text-[var(--sl-text-dim)]">Superset · abbina a</p>
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

        {/* Sciogli superset */}
        {partnerId && (
          <div className="px-4 pb-2 shrink-0">
            <button
              type="button"
              onClick={onRemove}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl min-h-[44px]
                text-amber-300 text-sm font-semibold
                border border-amber-600/40 bg-amber-500/10 active:bg-amber-500/20"
            >
              <Unlink size={15} strokeWidth={2.25} />
              Sciogli superset
            </button>
          </div>
        )}

        {/* Lista candidati (stessa sessione) */}
        <div className="overflow-y-auto overscroll-contain px-4 pb-6 space-y-1.5">
          <p className="sl-label text-[10px] text-[var(--sl-text-dim)] py-1">Altri esercizi della sessione</p>
          {candidates.map(ex => {
            const isPartner = ex.id === partnerId;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => onPick(ex.id)}
                className={[
                  'w-full text-left rounded-xl px-3 py-3 min-h-[48px] flex items-center gap-2 border',
                  isPartner
                    ? 'border-[var(--sl-violet)] bg-[rgba(139,92,255,0.14)]'
                    : 'border-[var(--sl-line-soft)] bg-[rgba(56,225,255,0.04)] active:bg-[rgba(56,225,255,0.12)]',
                ].join(' ')}
              >
                <span className="flex-1 text-slate-100 text-sm font-medium leading-snug">
                  {ex.name}
                  {ex.unilateral && <span className="text-slate-500 font-normal"> (per lato)</span>}
                </span>
                {isPartner && <Link2 size={14} className="text-[var(--sl-violet-soft)] shrink-0" />}
                <span className="text-[11px] text-[var(--sl-text-dim)] tabular-nums shrink-0">
                  {ex.prescribedSets}×{ex.repsTarget}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
