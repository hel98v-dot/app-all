// src/hooks/useToast.ts
import { useCallback, useState } from 'react';

export type ToastKind = 'ok' | 'err';

export interface ToastItem {
  id:      number;
  kind:    ToastKind;
  message: string;
}

let seq = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'ok') => {
    const id = ++seq;
    setToasts(prev => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return { toasts, show };
}
