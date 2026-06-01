// src/lib/records.ts
// Funzioni pure per record personali e stima 1RM. Operano sui SessionLog
// (nessuna dipendenza da React) — facilmente testabili.

import type { ExerciseLog, SessionLog, SetLog } from '../types';

/** Volume di una serie: reps × kg (o metri × kg per i carry). */
export function setVolume(s: SetLog): number {
  return s.reps * s.kg;
}

/**
 * Stima dell'1RM con la formula di Epley: kg × (1 + reps/30).
 * Con reps = 1 ritorna il carico stesso; serie a corpo libero (kg 0) → 0.
 */
export function estimate1RM(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}

/** Identifica univocamente una sessione loggata. */
export interface SessionKey {
  weekNumber: number;
  sessionId: string;
  date: string;
}

function isSameSession(s: SessionLog, key: SessionKey): boolean {
  return s.weekNumber === key.weekNumber && s.sessionId === key.sessionId && s.date === key.date;
}

/** Sintesi di una singola prestazione (una sessione) per un esercizio. */
export interface ExerciseEntry {
  date: string;
  weekNumber: number;
  volume: number;   // somma reps×kg dei set
  topKg: number;    // carico massimo in un set
  topE1rm: number;  // miglior 1RM stimato fra i set
}

/**
 * Storico cronologico (data crescente) di un esercizio attraverso tutte le
 * sessioni loggate. Esclude le sessioni senza volume e, opzionalmente, una
 * sessione "corrente" (quella in corso di compilazione).
 */
export function exerciseHistory(
  sessions: SessionLog[],
  exerciseId: string,
  exclude?: SessionKey,
): ExerciseEntry[] {
  const entries: ExerciseEntry[] = [];
  for (const session of sessions) {
    if (exclude && isSameSession(session, exclude)) continue;
    const exLog = session.exercises.find(e => e.exerciseId === exerciseId);
    if (!exLog || exLog.sets.length === 0) continue;

    let volume = 0;
    let topKg = 0;
    let topE1rm = 0;
    for (const s of exLog.sets) {
      volume += setVolume(s);
      if (s.kg > topKg) topKg = s.kg;
      const e = estimate1RM(s.kg, s.reps);
      if (e > topE1rm) topE1rm = e;
    }
    if (volume <= 0) continue;

    entries.push({ date: session.date, weekNumber: session.weekNumber, volume, topKg, topE1rm });
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** Record personali ricavati da uno storico già filtrato per esercizio. */
export interface ExerciseRecords {
  maxKg: number;
  maxE1rm: number;
  maxVolume: number; // miglior volume di sessione
  sessions: number;  // numero di prestazioni considerate
}

export function recordsFromHistory(history: ExerciseEntry[]): ExerciseRecords {
  return history.reduce<ExerciseRecords>(
    (acc, e) => ({
      maxKg: Math.max(acc.maxKg, e.topKg),
      maxE1rm: Math.max(acc.maxE1rm, e.topE1rm),
      maxVolume: Math.max(acc.maxVolume, e.volume),
      sessions: acc.sessions + 1,
    }),
    { maxKg: 0, maxE1rm: 0, maxVolume: 0, sessions: 0 },
  );
}

/**
 * Ultima prestazione registrata per un esercizio (set effettivi), utile per
 * pre-compilare i campi e mostrare il riferimento "ultima volta".
 * Esclude opzionalmente la sessione corrente.
 */
export function lastPerformance(
  sessions: SessionLog[],
  exerciseId: string,
  exclude?: SessionKey,
): { date: string; weekNumber: number; sets: SetLog[] } | null {
  const matching = sessions
    .filter(s => !(exclude && isSameSession(s, exclude)))
    .map(s => ({ session: s, ex: s.exercises.find(e => e.exerciseId === exerciseId) }))
    .filter((x): x is { session: SessionLog; ex: ExerciseLog } =>
      !!x.ex && x.ex.sets.some(set => set.reps > 0))
    .sort((a, b) => a.session.date.localeCompare(b.session.date));

  const last = matching[matching.length - 1];
  if (!last) return null;
  return { date: last.session.date, weekNumber: last.session.weekNumber, sets: last.ex.sets };
}

/** Riepilogo dei record di una serie di set (la prestazione "corrente"). */
export function bestOfSets(sets: SetLog[]): { topKg: number; topE1rm: number; volume: number } {
  let topKg = 0;
  let topE1rm = 0;
  let volume = 0;
  for (const s of sets) {
    volume += setVolume(s);
    if (s.kg > topKg) topKg = s.kg;
    const e = estimate1RM(s.kg, s.reps);
    if (e > topE1rm) topE1rm = e;
  }
  return { topKg, topE1rm, volume };
}
