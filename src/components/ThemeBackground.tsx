// src/components/ThemeBackground.tsx
// Layer di sfondo full-screen, dietro a tutto il contenuto.
// Mostra l'immagine utente risolta per ordine di priorità + scrim leggibilità,
// oppure lo sfondo "System" generato in CSS.
import { useBackgrounds } from '../hooks/useBackgrounds';

interface Props {
  /** Chiavi sfondo in ordine di priorità (la prima disponibile vince). */
  keys: string[];
}

export function ThemeBackground({ keys }: Props) {
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
        <div className="sl-bg-default" />
      )}
    </div>
  );
}
