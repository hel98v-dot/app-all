// src/components/BackgroundPicker.tsx
// Controllo riutilizzabile per caricare / rimuovere uno sfondo immagine.
import { useId, useRef, useState } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { useBackgrounds } from '../hooks/useBackgrounds';

interface Props {
  bgKey: string;
  label: string;
  /** Variante compatta: solo icona (es. header esercizio). */
  compact?: boolean;
  onDone?: (action: 'set' | 'clear') => void;
}

export function BackgroundPicker({ bgKey, label, compact, onDone }: Props) {
  const { urls, setBackground, clearBackground } = useBackgrounds();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId  = useId();
  const [busy, setBusy] = useState(false);
  const hasImage = Boolean(urls[bgKey]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await setBackground(bgKey, file);
      onDone?.('set');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await clearBackground(bgKey);
      onDone?.('clear');
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : ImagePlus;

  // ── Variante compatta (icona singola) ─────────────────────────────────
  if (compact) {
    return (
      <>
        <input
          ref={inputRef} id={inputId} type="file" accept="image/*"
          className="hidden" onChange={handleFile}
        />
        <button
          onClick={() => (hasImage ? handleClear() : inputRef.current?.click())}
          disabled={busy}
          aria-label={hasImage ? `Rimuovi sfondo ${label}` : `Imposta sfondo ${label}`}
          className="w-11 h-11 flex items-center justify-center rounded-lg
            border border-[var(--sl-line)] bg-[rgba(56,225,255,0.06)]
            active:bg-[rgba(56,225,255,0.16)] transition-colors"
        >
          {hasImage
            ? <Trash2 size={18} className="text-rose-400" />
            : <Icon size={18} className={busy ? 'text-cyan-300 animate-spin' : 'text-cyan-300'} />}
        </button>
      </>
    );
  }

  // ── Variante estesa (riga in Impostazioni) ────────────────────────────
  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef} id={inputId} type="file" accept="image/*"
        className="hidden" onChange={handleFile}
      />

      {/* Anteprima */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[var(--sl-line)]
        bg-[rgba(10,19,38,0.6)] flex items-center justify-center">
        {hasImage
          ? <img src={urls[bgKey]} alt="" className="w-full h-full object-cover" />
          : <ImagePlus size={20} className="text-[var(--sl-text-dim)]" />}
      </div>

      <span className="flex-1 text-sm font-semibold text-slate-200" style={{ fontFamily: 'var(--font-ui)' }}>
        {label}
      </span>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="sl-btn-ghost min-h-[44px] px-3 rounded-lg text-sm flex items-center gap-1.5"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        {hasImage ? 'Cambia' : 'Carica'}
      </button>

      {hasImage && (
        <button
          onClick={handleClear}
          disabled={busy}
          aria-label="Rimuovi sfondo"
          className="w-11 h-11 flex items-center justify-center rounded-lg
            border border-rose-800/40 bg-slate-800 active:bg-rose-950/30 transition-colors"
        >
          <Trash2 size={17} className="text-rose-400" />
        </button>
      )}
    </div>
  );
}
