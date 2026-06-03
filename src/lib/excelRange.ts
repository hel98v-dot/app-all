// src/lib/excelRange.ts
// Gestione dei range reps/RPE ("8-10", "7-8") che Excel può trasformare in date.
// Excel salva "8-10" come data (8 ottobre) → numero seriale (es. 46303); qui lo
// riconosciamo e ricostruiamo il range dai due numeri della data, in ordine
// crescente (i range reps/RPE sono crescenti).

const EXCEL_EPOCH_OFFSET = 25569;      // giorni dal 1900 al 1970
const MS_PER_DAY = 86400000;
const SERIAL_THRESHOLD = 1000;         // sopra questo, un "range" è quasi certamente una data

function serialToRange(n: number): string | null {
  const d = new Date(Math.round((n - EXCEL_EPOCH_OFFSET) * MS_PER_DAY));
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (m >= 1 && m <= 31 && day >= 1 && day <= 31) {
    const [lo, hi] = [m, day].sort((a, b) => a - b);
    return `${lo}-${hi}`;
  }
  return null;
}

/** Cella grezza (numero o stringa) letta dall'Excel → testo del range. */
export function parseRangeCell(raw: unknown): string {
  if (typeof raw === 'number' && raw > SERIAL_THRESHOLD) {
    return serialToRange(raw) ?? String(raw);
  }
  return String(raw ?? '').trim();
}

/** Ripara un valore GIÀ salvato come stringa (es. "46303" → "8-10"). */
export function repairRange(value: string): string {
  const n = Number(value);
  if (Number.isInteger(n) && n > SERIAL_THRESHOLD) {
    return serialToRange(n) ?? value;
  }
  return value;
}
