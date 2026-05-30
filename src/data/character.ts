// src/data/character.ts
// Sistema Personaggio (RPG-style) — configurazione delle 5 statistiche.
// Modifica i valori di STAT_TARGETS se le stat salgono troppo facilmente al rating S
// nei mesocicli successivi: alza il target per quella stat e rendi più sfidante il livello.

import { BASE_SESSIONS, type Exercise } from './program';

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
export function getEnduranceHighRepsIds(): string[] {
  const ids: string[] = [];
  for (const session of BASE_SESSIONS) {
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
