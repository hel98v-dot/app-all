// src/types.ts
// Tipi TypeScript condivisi.

/** Un singolo set eseguito: reps (o metri) × carico. */
export type SetLog = {
  reps: number;
  kg: number;
};

/** Log di un singolo esercizio all'interno di una sessione. */
export type ExerciseLog = {
  exerciseId: string;
  sets: SetLog[];
  completedAt: string;   // ISO timestamp
  notes?: string;        // note libere dell'utente
};

/** Log di una singola sessione di allenamento. */
export type SessionLog = {
  id: string;
  weekNumber: number;
  sessionId: string;
  date: string;          // YYYY-MM-DD
  exercises: ExerciseLog[];
};

/** Struttura del localStorage per i log (chiave: "training-log-v1-{profileId}"). */
export type LogStore = {
  startDate: string;     // YYYY-MM-DD
  sessions: SessionLog[];
};

// ── Profili ───────────────────────────────────────────────────────────────────

/** Un profilo utente. */
export type Profile = {
  id: string;
  name: string;
  createdAt: string;     // ISO timestamp
};

/** Store dei profili (chiave localStorage: "profiles-v1"). */
export type ProfileStore = {
  profiles: Profile[];
  activeId: string;
};
