// src/data/character.ts
// Sistema Personaggio (RPG-style) — configurazione delle 5 statistiche.
// Modifica i valori di STAT_TARGETS se le stat salgono troppo facilmente al rating S
// nei mesocicli successivi: alza il target per quella stat e rendi più sfidante il livello.

import { BASE_SESSIONS, type Exercise, type Session } from './program';

// -------------------------------------------------------------------
// Classificazione degli esercizi
// -------------------------------------------------------------------

/** Multiarticolari principali per il calcolo della stat FORZA. */
export const STRENGTH_PRIMARY_IDS: string[] = [
  'lun-1',   // Panca piana con manubri
  'gio-1',   // Hip thrust con bilanciere
  'gio-3',   // Romanian Deadlift (trap bar o DB)
  'ven-1',   // Lat machine pronata
  'ven-2',   // Rematore manubri panca 30°
];

/** Esercizi anti-movement per il calcolo della stat CORE/STABILITÀ. */
export const CORE_ANTI_MOVEMENT_IDS: string[] = [
  'lun-7',   // Suitcase carry monolaterale
  'lun-8',   // Pallof press in piedi
  'mar-7',   // Ab wheel rollout
  'mar-8',   // Bottoms-up KB carry
  'gio-7',   // Renegade row
  'ven-8',   // Single-arm farmer carry
  'ven-9',   // Pallof press half-kneeling
  'sab-9',   // Stir-the-pot con ab wheel
  'sab-10',  // Suitcase carry (casa)
];

/**
 * Esercizi "endurance" (range alti o carries) per il calcolo della stat RESISTENZA.
 * Derivato dinamicamente da program.ts: un esercizio è "endurance" se
 * il suo reps target include "12-15", "15-20", "10-15", "passi"
 * oppure se metric === 'meters' (carries).
 */
export function getEnduranceHighRepsIds(sessions: Session[] = BASE_SESSIONS): string[] {
  const ids: string[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (isEnduranceExercise(exercise)) {
        ids.push(exercise.id);
      }
    }
  }
  return ids;
}

function isEnduranceExercise(ex: Exercise): boolean {
  if (ex.metric === 'meters') return true;
  const reps = ex.repsTarget;
  return (
    reps.includes('12-15') ||
    reps.includes('15-20') ||
    reps.includes('10-15') ||
    reps.includes('passi')
  );
}

// -------------------------------------------------------------------
// Riferimenti "livello avanzato" per esercizio
// -------------------------------------------------------------------
// reps × kg ≈ la MIGLIORE serie attesa da un atleta AVANZATO (non elite).
// Le statistiche confrontano la tua miglior serie delle 4 settimane con questi
// riferimenti: raggiungerli = punteggio pieno (100) per quell'esercizio.
//   • kg > 0  → esercizio con carico: punteggio = bestSet(reps×kg) / (reps×kg) di rif.
//   • kg = 0  → corpo libero: punteggio = best reps / reps di rif.
//   • metric 'meters' (carry) → reps = metri di riferimento.
// I valori sono basati su standard medi avanzati: modificali liberamente qui
// se li trovi troppo alti o troppo bassi per il tuo livello.

export interface ExerciseRef { reps: number; kg: number }

export const EXERCISE_REFS: Record<string, ExerciseRef> = {
  // LUN — Upper Push + Core
  'lun-1': { reps: 10, kg: 50 },   // Panca piana DB
  'lun-2': { reps: 12, kg: 40 },   // Panca inclinata 30° DB
  'lun-3': { reps: 15, kg: 25 },   // Croci ai cavi
  'lun-4': { reps: 15, kg: 14 },   // Alzate laterali
  'lun-5': { reps: 12, kg: 45 },   // Pushdown corda
  'lun-6': { reps: 15, kg: 18 },   // French press DB
  'lun-7': { reps: 30, kg: 32 },   // Suitcase carry (metri)
  'lun-8': { reps: 10, kg: 25 },   // Pallof press

  // MAR — Lower + Glutei + Core
  'mar-1': { reps: 15, kg: 40 },   // Goblet squat
  'mar-2': { reps: 12, kg: 60 },   // RDL DB
  'mar-3': { reps: 20, kg: 60 },   // Hip thrust BW + zavorra
  'mar-4': { reps: 10, kg: 24 },   // Single-leg RDL
  'mar-5': { reps: 12, kg: 0  },   // Lateral walk elastico
  'mar-6': { reps: 20, kg: 0  },   // Clamshell elastico
  'mar-7': { reps: 12, kg: 0  },   // Ab wheel rollout
  'mar-8': { reps: 30, kg: 16 },   // Bottoms-up KB carry (metri)

  // GIO — Lower Glute-Focused + Core
  'gio-1': { reps: 10, kg: 200 },  // Hip thrust bilanciere
  'gio-2': { reps: 12, kg: 40 },   // Bulgarian split squat
  'gio-3': { reps: 9,  kg: 100 },  // Romanian Deadlift
  'gio-4': { reps: 15, kg: 200 },  // Leg press piedi alti
  'gio-5': { reps: 15, kg: 30 },   // Cable hip abduction
  'gio-6': { reps: 15, kg: 20 },   // Back extension 45°
  'gio-7': { reps: 8,  kg: 24 },   // Renegade row

  // VEN — Upper Pull + Braccia + Core
  'ven-1': { reps: 9,  kg: 75 },   // Lat machine pronata
  'ven-2': { reps: 11, kg: 45 },   // Rematore DB
  'ven-3': { reps: 12, kg: 75 },   // Pulley basso
  'ven-4': { reps: 15, kg: 35 },   // Face pull
  'ven-5': { reps: 12, kg: 18 },   // Curl DB inclinata
  'ven-6': { reps: 12, kg: 20 },   // Hammer curl
  'ven-7': { reps: 12, kg: 35 },   // Skull crusher EZ
  'ven-8': { reps: 40, kg: 32 },   // Farmer carry (metri)
  'ven-9': { reps: 10, kg: 25 },   // Pallof half-kneeling

  // SAB — Upper Push + Core (casa)
  'sab-1':  { reps: 12, kg: 20 },  // Push-up zavorrato
  'sab-2':  { reps: 12, kg: 0  },  // Deficit push-up
  'sab-3':  { reps: 12, kg: 0  },  // Pike push-up
  'sab-4':  { reps: 15, kg: 35 },  // Floor press DB
  'sab-5':  { reps: 15, kg: 0  },  // Croci elastico
  'sab-6':  { reps: 15, kg: 14 },  // Alzate laterali
  'sab-7':  { reps: 15, kg: 16 },  // Curl DB
  'sab-8':  { reps: 15, kg: 0  },  // Pushdown elastico
  'sab-9':  { reps: 10, kg: 0  },  // Stir-the-pot
  'sab-10': { reps: 40, kg: 24 },  // Suitcase carry (metri)
};

/** Carico avanzato di default per muscolo — fallback per programmi custom. */
const MUSCLE_DEFAULT_KG: Record<string, number> = {
  Petto: 40, Dorso: 60, Spalle: 16, Bicipiti: 18, Tricipiti: 30,
  Glutei: 120, Quadricipiti: 80, Femorali: 70, Addome: 0,
};

/** Estrae il numero di reps di riferimento (il più alto presente nel target). */
export function parseTopReps(repsTarget: string): number {
  const nums = (repsTarget.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : 10;
}

/** Riferimento per un esercizio: esplicito se noto, altrimenti derivato. */
export function getExerciseRef(ex: Exercise): ExerciseRef {
  const explicit = EXERCISE_REFS[ex.id];
  if (explicit) return explicit;
  return { reps: parseTopReps(ex.repsTarget), kg: MUSCLE_DEFAULT_KG[ex.muscle] ?? 20 };
}

/** Volume di riferimento di una serie (0 se a corpo libero). */
export function refSetVolume(ex: Exercise): number {
  const r = getExerciseRef(ex);
  return r.kg > 0 ? r.reps * r.kg : 0;
}

/** Punteggio 0-1 di un esercizio dato il best set loggato. */
export function exerciseScore(ex: Exercise, bestVol: number, bestReps: number): number {
  const r = getExerciseRef(ex);
  if (r.kg > 0) {
    const refVol = r.reps * r.kg;
    return refVol > 0 ? Math.min(1, bestVol / refVol) : 0;
  }
  return r.reps > 0 ? Math.min(1, bestReps / r.reps) : 0;
}

// -------------------------------------------------------------------
// Target massimi per la normalizzazione 0-100
// -------------------------------------------------------------------

export interface StatTargets {
  forza: number;
  resistenza: number;
  costanza: number;       // numero sessioni
  volume: number;
  core: number;
}

export const STAT_TARGETS: StatTargets = {
  forza: 90000,
  resistenza: 130000,
  costanza: 25,           // 5 settimane × 5 sessioni
  volume: 280000,
  core: 70000,
};

// -------------------------------------------------------------------
// Pesi del livello globale
// -------------------------------------------------------------------

export const GLOBAL_LEVEL_WEIGHTS = {
  forza: 0.25,
  resistenza: 0.15,
  costanza: 0.20,
  volume: 0.25,
  core: 0.15,
} as const;

// -------------------------------------------------------------------
// Rating (D-S)
// -------------------------------------------------------------------

export type Rating = 'D' | 'C' | 'B' | 'A' | 'S';

export const RATING_COLORS: Record<Rating, { bg: string; text: string }> = {
  S: { bg: '#FFD700', text: '#1a1a1a' },  // gold
  A: { bg: '#C0C0C0', text: '#1a1a1a' },  // silver
  B: { bg: '#CD7F32', text: '#ffffff' },  // bronze
  C: { bg: '#8FBC8F', text: '#1a1a1a' },  // sea green
  D: { bg: '#A9A9A9', text: '#1a1a1a' },  // gray
};

export function ratingFromValue(value: number): Rating {
  if (value >= 80) return 'S';
  if (value >= 60) return 'A';
  if (value >= 40) return 'B';
  if (value >= 20) return 'C';
  return 'D';
}

// -------------------------------------------------------------------
// Achievement
// -------------------------------------------------------------------

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  hint: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'iron-glutes',
    icon: '💪',
    name: 'IRON GLUTES',
    description: 'Volume glutei mesociclo > 20.000',
    hint: 'Glutei: priorità raggiunta',
  },
  {
    id: 'core-warrior',
    icon: '🛡',
    name: 'CORE WARRIOR',
    description: 'CORE/Stabilità ≥ 70 (rating A)',
    hint: 'La lombare ringrazia',
  },
  {
    id: 'strong-intermediate',
    icon: '⚔',
    name: 'STRONG INTERMEDIATE',
    description: 'FORZA ≥ 60 (rating A)',
    hint: 'Carichi solidi sui big lift',
  },
  {
    id: 'perfect-attendance',
    icon: '🎯',
    name: 'PERFECT ATTENDANCE',
    description: 'COSTANZA ≥ 95 (≥ 24/25 sessioni)',
    hint: 'La disciplina paga',
  },
  {
    id: 'volume-beast',
    icon: '🔥',
    name: 'VOLUME BEAST',
    description: 'VOLUME ≥ 80',
    hint: 'Hai macinato lavoro',
  },
  {
    id: 'well-rounded-hero',
    icon: '👑',
    name: 'WELL-ROUNDED HERO',
    description: 'Tutte le stat ≥ 60',
    hint: 'Atleta completo',
  },
  {
    id: 'progressive-overload',
    icon: '💎',
    name: 'PROGRESSIVE OVERLOAD',
    description: 'Volume Sett 4 ≥ +20% vs Sett 1',
    hint: 'Crescita reale, non rumore',
  },
  {
    id: 'legend',
    icon: '🌟',
    name: 'LEGEND',
    description: 'Livello globale = S (≥ 80)',
    hint: 'Hall of fame',
  },
];

// -------------------------------------------------------------------
// Tipi delle stat calcolate
// -------------------------------------------------------------------

export interface CharacterStats {
  forza: number;          // 0-100
  resistenza: number;
  costanza: number;
  volume: number;
  core: number;
  /** Livello globale 0-100 (media pesata) */
  globalLevel: number;
  /** XP totali (volume mesociclo / 100) */
  xp: number;
  /** Achievement sbloccati: array di id */
  unlockedAchievements: string[];
  /** Volume grezzo per debug/visualizzazione */
  raw: {
    volForza: number;
    volResistenza: number;
    volCore: number;
    volMesocycle: number;
    sessionsCompleted: number;
    volGlutei: number;
    volWeek1: number;
    volWeek4: number;
  };
}
