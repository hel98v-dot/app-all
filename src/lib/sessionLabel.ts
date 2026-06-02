// src/lib/sessionLabel.ts
// Etichetta sintetica di una sessione: A (Push), B (Glutei/Gambe), C (Pull),
// con suffisso "1" se svolta a casa (A1 / B1 / C1).
// Usa il nome/focus della sessione se già è un codice A/B/C, altrimenti lo
// deriva dal tipo di movimento.

import type { Session } from '../data/program';

export const BLOCK_NAMES: Record<string, string> = {
  A: 'Push',
  B: 'Glutei / Gambe',
  C: 'Pull',
};

function blockLetter(focus: string): 'A' | 'B' | 'C' {
  const explicit = focus.trim().match(/^([ABC])\b/i);
  if (explicit) return explicit[1]!.toUpperCase() as 'A' | 'B' | 'C';
  const f = focus.toLowerCase();
  if (f.includes('push') || f.includes('spinta')) return 'A';
  if (f.includes('pull') || f.includes('tirata')) return 'C';
  return 'B'; // lower / glutei / gambe
}

/** Codice breve della sessione: "A", "B", "C", oppure "A1"/"B1"/"C1" se a casa. */
export function sessionCode(s: Session): string {
  const letter = blockLetter(s.focus || '');
  return s.location === 'casa' ? `${letter}1` : letter;
}

/** Descrizione lunga: es. "A · Push" oppure "B1 · Glutei / Gambe (casa)". */
export function sessionTitle(s: Session): string {
  const code = sessionCode(s);
  const letter = code[0] ?? 'B';
  const name = BLOCK_NAMES[letter] ?? '';
  return s.location === 'casa' ? `${code} · ${name} (casa)` : `${code} · ${name}`;
}
