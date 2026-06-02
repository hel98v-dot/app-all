// src/components/ErrorBoundary.tsx
// Cattura gli errori di render delle schermate e mostra un recupero invece
// dello schermo bianco — con possibilità di scaricare un backup dei dati.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

/** Scarica TUTTO il localStorage come JSON (rete di salvataggio dei dati). */
function downloadAllData(): void {
  try {
    const dump: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) dump[k] = localStorage.getItem(k) ?? '';
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 px-6 text-center bg-[var(--sl-bg)]">
        <AlertTriangle size={44} className="text-amber-400" strokeWidth={1.5} />
        <div>
          <h1 className="sl-heading text-xl">Errore di sistema</h1>
          <p className="text-[var(--sl-text-dim)] text-sm mt-2 max-w-xs leading-relaxed">
            Qualcosa è andato storto in questa schermata. I tuoi dati sono al sicuro:
            scarica un backup e ricarica l'app.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <button
            onClick={downloadAllData}
            className="sl-btn-ghost flex items-center justify-center gap-2 py-3 rounded-2xl min-h-[52px]"
          >
            <Download size={18} /> Scarica backup dati
          </button>
          <button
            onClick={() => window.location.reload()}
            className="sl-btn flex items-center justify-center gap-2 py-3 rounded-2xl min-h-[52px]"
          >
            <RotateCcw size={18} strokeWidth={2.5} /> Ricarica l'app
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre className="text-[10px] text-rose-400/80 max-w-full overflow-auto px-2">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
