// src/types.ts
// Tipi TypeScript condivisi — importati da program.ts e dai componenti.

/** Un singolo set eseguito: reps (o metri) × carico. */
export type SetLog = {
  reps: number;   // può rappresentare anche "metri" per esercizi metric='meters'
  kg: number;
};

/** Log di un singolo esercizio all'interno di una sessione. */
export type ExerciseLog = {
  exerciseId: string;
  sets: SetLog[];
  completedAt: string;   // ISO timestamp, es. "2025-06-01T10:30:00.000Z"
  notes?: string;
};

/** Log di una singola sessione di allenamento. */
export type SessionLog = {
  /** UUID generato al momento della creazione. */
  id: string;
  weekNumber: number;    // 1-5
  sessionId: string;     // corrisponde a Session.id (es. "lun", "mar", …)
  date: string;          // YYYY-MM-DD, es. "2025-06-02"
  exercises: ExerciseLog[];
};

/** Struttura completa del localStorage (chiave: "training-log-v1"). */
export type LogStore = {
  /** Data di inizio del mesociclo, fissata al primo avvio. YYYY-MM-DD. */
  startDate: string;
  sessions: SessionLog[];
};
