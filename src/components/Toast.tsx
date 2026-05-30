// src/components/Toast.tsx
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ToastItem } from '../hooks/useToast';

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-24 inset-x-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={[
            'flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl',
            'text-sm font-medium',
            t.kind === 'ok'
              ? 'bg-emerald-900 border border-emerald-700 text-emerald-100'
              : 'bg-rose-900    border border-rose-700    text-rose-100',
          ].join(' ')}
        >
          {t.kind === 'ok'
            ? <CheckCircle2 size={16} className="shrink-0" />
            : <XCircle      size={16} className="shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
