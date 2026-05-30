// src/lib/dates.ts
// Utility per la gestione delle date nel formato YYYY-MM-DD.
// Nessuna dipendenza esterna — usa solo l'API Date nativa.

// -------------------------------------------------------------------
// Formattazione
// -------------------------------------------------------------------

/**
 * Restituisce la data nel formato YYYY-MM-DD (ora locale).
 * Usare questa funzione anziché toISOString() che converte in UTC.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Restituisce la data odierna nel formato YYYY-MM-DD (ora locale). */
export function today(): string {
  return formatDate(new Date());
}

// -------------------------------------------------------------------
// Parsing
// -------------------------------------------------------------------

/**
 * Parsa una stringa YYYY-MM-DD in un oggetto Date (mezzanotte ora locale).
 * Evita il problema UTC di `new Date("YYYY-MM-DD")` che restituisce
 * la mezzanotte UTC (potenzialmente il giorno precedente in fuso negativo).
 */
export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

// -------------------------------------------------------------------
// Differenze
// -------------------------------------------------------------------

/**
 * Differenza in giorni interi tra due date YYYY-MM-DD (b − a).
 * Il risultato è positivo se b è successivo ad a, negativo se precedente.
 */
export function diffDays(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / msPerDay);
}

/**
 * Aggiunge `days` giorni a una data YYYY-MM-DD e restituisce il risultato
 * nello stesso formato. Accetta valori negativi per sottrarre giorni.
 */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

// -------------------------------------------------------------------
// Confronto
// -------------------------------------------------------------------

/** Restituisce true se a < b (confronto lessicografico su YYYY-MM-DD). */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}

/** Restituisce true se a > b. */
export function isAfter(a: string, b: string): boolean {
  return a > b;
}

/** Restituisce true se a === b. */
export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

// -------------------------------------------------------------------
// Display (UI in italiano)
// -------------------------------------------------------------------

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'] as const;
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;

/**
 * Formatta una data YYYY-MM-DD per la UI: "Lunedì 2 giu".
 */
export function formatDisplay(iso: string): string {
  const d = parseDate(iso);
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

/**
 * Formatta una data YYYY-MM-DD con l'anno: "2 giu 2025".
 */
export function formatDisplayFull(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}
