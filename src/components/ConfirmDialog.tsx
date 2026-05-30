// src/components/ConfirmDialog.tsx
// Modal di conferma custom — sostituisce window.confirm per azioni distruttive.
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  open:        boolean;
  title:       string;
  description: string;
  confirmLabel?: string;
  danger?:     boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = 'Conferma',
  danger = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8"
      onClick={onCancel}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Icona + titolo */}
        <div className="flex items-start gap-3">
          <div className={[
            'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            danger ? 'bg-rose-900/60' : 'bg-amber-900/60',
          ].join(' ')}>
            {danger
              ? <Trash2         size={18} className="text-rose-400" />
              : <AlertTriangle  size={18} className="text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-100">{title}</p>
            <p className="text-sm text-slate-400 mt-0.5 leading-snug">{description}</p>
          </div>
        </div>

        {/* Azioni */}
        <div className="flex gap-2.5 pt-1">
          {/* Annulla — touch target 52px */}
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl bg-slate-800 border border-slate-700
              text-slate-300 font-semibold text-sm active:bg-slate-700 transition-colors"
          >
            Annulla
          </button>

          {/* Conferma */}
          <button
            onClick={onConfirm}
            className={[
              'flex-1 py-3.5 rounded-2xl font-bold text-sm transition-colors',
              danger
                ? 'bg-rose-600  active:bg-rose-500  text-white'
                : 'bg-amber-600 active:bg-amber-500 text-white',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
