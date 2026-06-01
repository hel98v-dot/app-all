// src/lib/restTime.ts
// Converte la stringa di recupero del programma in secondi e formatta i tempi.

const DEFAULT_REST_SECONDS = 90;

/**
 * Estrae i secondi di recupero da una stringa di prescrizione.
 * Convenzioni del programma (vedi program.ts):
 *  - apice singolo  '  → minuti  (es. "2'", "2-3'")
 *  - doppio apice   "  → secondi (es. "90\"", "75\"")
 * Per i range ("2-3'") usa il primo numero (recupero minimo).
 * Se non interpretabile, ritorna 90s.
 */
export function parseRestSeconds(rest: string | undefined): number {
  if (!rest) return DEFAULT_REST_SECONDS;
  const match = rest.match(/\d+/);
  if (!match) return DEFAULT_REST_SECONDS;
  const n = parseInt(match[0], 10);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_REST_SECONDS;
  // L'apice dei minuti ha priorità: "2-3'" = minuti, '90"' = secondi.
  const isMinutes = rest.includes("'");
  return isMinutes ? n * 60 : n;
}

/** Formatta i secondi in "M:SS" (es. 95 → "1:35"). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
