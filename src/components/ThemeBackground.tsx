// src/components/ThemeBackground.tsx
// Layer di sfondo full-screen, dietro a tutto il contenuto.
// Mostra l'immagine utente risolta per ordine di priorità + scrim leggibilità,
// oppure lo sfondo "System" generato in CSS (gradiente + scena portale + particelle).
import { useBackgrounds } from '../hooks/useBackgrounds';

export type Accent = 'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber';

interface Props {
  /** Chiavi sfondo in ordine di priorità (la prima disponibile vince). */
  keys: string[];
  /** Accento cromatico della scena di default (default: cyan). */
  accent?: Accent;
}

const ACCENT_CLASS: Record<Accent, string> = {
  cyan:    '',
  violet:  'sl-acc-violet',
  magenta: 'sl-acc-magenta',
  emerald: 'sl-acc-emerald',
  amber:   'sl-acc-amber',
};

export function ThemeBackground({ keys, accent = 'cyan' }: Props) {
  const { resolve } = useBackgrounds();
  const url = resolve(keys);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden sl-scanlines" aria-hidden>
      {url ? (
        <>
          <div className="sl-bg-image" style={{ backgroundImage: `url("${url}")` }} />
          <div className="sl-bg-scrim" />
        </>
      ) : (
        <>
          <div className="sl-bg-default" />
          <div className={`sl-bg-scene ${ACCENT_CLASS[accent]}`} />
        </>
      )}
    </div>
  );
}
