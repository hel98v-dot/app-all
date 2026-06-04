// src/lib/completion.ts
// Stato di completamento basato sulle serie EFFETTIVAMENTE svolte (reps > 0),
// non sulla lunghezza dell'array (che include i campi pre-compilati a 0).

import type { SessionLog, ExerciseLog } from '../types';

/** Numero di serie svolte (con reps > 0) di un esercizio. */
export function doneSets(log: ExerciseLog): number {
  return log.sets.filter(s => s.reps > 0).length;
}

export type SessionStatus = 'empty' | 'partial' | 'full';

/**
 * Stato di una sessione loggata.
 * `prescribedOf(exerciseId)` restituisce i set previsti (se noti).
 *  - empty:   nessuna serie svolta
 *  - partial: qualche serie svolta ma non tutto completo
 *  - full:    tutti gli esercizi loggati sono completi
 */
export function sessionStatus(
  session: SessionLog,
  prescribedOf: (exerciseId: string) => number | undefined,
): SessionStatus {
  let anyDone = false;
  let allComplete = true;
  for (const ex of session.exercises) {
    const done = doneSets(ex);
    if (done === 0) continue;
    anyDone = true;
    const prescribed = prescribedOf(ex.exerciseId) ?? done;
    if (done < prescribed) allComplete = false;
  }
  if (!anyDone) return 'empty';
  return allComplete ? 'full' : 'partial';
}
