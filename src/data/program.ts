// src/data/program.ts
// Piano di allenamento statico — generato da Claude (chat) per Claude Code.
// NON modificare a runtime. Per cambiare il piano, modifica questo file.

export type Muscle =
  | 'Petto'
  | 'Dorso'
  | 'Spalle'
  | 'Bicipiti'
  | 'Tricipiti'
  | 'Glutei'
  | 'Quadricipiti'
  | 'Femorali'
  | 'Addome';

export type DayKey =
  | 'lunedi'
  | 'martedi'
  | 'mercoledi'
  | 'giovedi'
  | 'venerdi'
  | 'sabato'
  | 'domenica';

export type Location = 'palestra' | 'casa';

export type MetricUnit = 'reps' | 'meters';

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  prescribedSets: number;
  repsTarget: string;
  rpeTarget: string;
  rest: string;
  unilateral?: boolean;
  metric?: MetricUnit;
  notes?: string;
  /** Marcatore superset: esercizi della stessa sessione con lo stesso valore
   *  vengono pre-abbinati in un superset (impostato dalla scheda Excel). */
  supersetGroup?: string;
}

export interface Session {
  id: string;
  day: DayKey;
  dayLabel: string;
  focus: string;
  location: Location;
  exercises: Exercise[];
}

export interface Week {
  number: number;
  label: string;
  isDeload: boolean;
  sessions: Session[];
}

// -------------------------------------------------------------------
// SESSIONI BASE (settimane 1-4)
// -------------------------------------------------------------------

const SESSION_LUN: Session = {
  id: 'lun',
  day: 'lunedi',
  dayLabel: 'Lunedì',
  focus: 'Upper Push + Core',
  location: 'palestra',
  exercises: [
    { id: 'lun-1', name: 'Panca piana con manubri', muscle: 'Petto', prescribedSets: 4, repsTarget: '8-10', rpeTarget: '7-8', rest: "2-3'" },
    { id: 'lun-2', name: 'Panca inclinata 30° manubri', muscle: 'Petto', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '7-8', rest: "2'" },
    { id: 'lun-3', name: 'Croci ai cavi (alto-basso)', muscle: 'Petto', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8-9', rest: '90"' },
    { id: 'lun-4', name: 'Alzate laterali manubri', muscle: 'Spalle', prescribedSets: 4, repsTarget: '12-15', rpeTarget: '8-9', rest: '75"' },
    { id: 'lun-5', name: 'Pushdown ai cavi (corda)', muscle: 'Tricipiti', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '8-9', rest: '90"' },
    { id: 'lun-6', name: 'French press manubrio', muscle: 'Tricipiti', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8-9', rest: '75"' },
    { id: 'lun-7', name: 'Suitcase carry monolaterale', muscle: 'Addome', prescribedSets: 3, repsTarget: '30m/lato', rpeTarget: '8', rest: '90"', unilateral: true, metric: 'meters' },
    { id: 'lun-8', name: 'Pallof press in piedi (cavi)', muscle: 'Addome', prescribedSets: 3, repsTarget: '10/lato + 3" hold', rpeTarget: '8', rest: '60"', unilateral: true },
  ],
};

const SESSION_MAR: Session = {
  id: 'mar',
  day: 'martedi',
  dayLabel: 'Martedì',
  focus: 'Lower + Glutei + Core anti-estensione',
  location: 'casa',
  exercises: [
    { id: 'mar-1', name: 'Goblet squat (KB 12kg + vest 10kg)', muscle: 'Quadricipiti', prescribedSets: 4, repsTarget: '12-15', rpeTarget: '7-8', rest: "2'" },
    { id: 'mar-2', name: 'RDL con manubri (tempo 3-1-1)', muscle: 'Femorali', prescribedSets: 4, repsTarget: '10-12', rpeTarget: '7-8', rest: "2'" },
    { id: 'mar-3', name: 'Hip thrust BW + giubbotto 10kg', muscle: 'Glutei', prescribedSets: 4, repsTarget: '15-20', rpeTarget: '8', rest: '90"' },
    { id: 'mar-4', name: 'Single-leg RDL manubrio', muscle: 'Femorali', prescribedSets: 3, repsTarget: '10/gamba', rpeTarget: '8', rest: '75"', unilateral: true },
    { id: 'mar-5', name: 'Lateral walk con elastico', muscle: 'Glutei', prescribedSets: 3, repsTarget: '12 passi/dir', rpeTarget: '8', rest: '60"' },
    { id: 'mar-6', name: 'Clamshell con elastico', muscle: 'Glutei', prescribedSets: 3, repsTarget: '15-20/lato', rpeTarget: '8', rest: '45"', unilateral: true },
    { id: 'mar-7', name: 'Ab wheel rollout (ginocchia)', muscle: 'Addome', prescribedSets: 4, repsTarget: '8-12', rpeTarget: '8', rest: '90"' },
    { id: 'mar-8', name: 'Bottoms-up KB carry (12kg)', muscle: 'Addome', prescribedSets: 3, repsTarget: '20-30m/lato', rpeTarget: '8', rest: '75"', unilateral: true, metric: 'meters' },
  ],
};

const SESSION_GIO: Session = {
  id: 'gio',
  day: 'giovedi',
  dayLabel: 'Giovedì',
  focus: 'Lower Glute-Focused + Core anti-rotazione',
  location: 'palestra',
  exercises: [
    { id: 'gio-1', name: 'Hip thrust con bilanciere', muscle: 'Glutei', prescribedSets: 4, repsTarget: '8-12', rpeTarget: '7-8', rest: "2-3'", notes: 'Movimento principale della sessione' },
    { id: 'gio-2', name: 'Bulgarian split squat con DB', muscle: 'Quadricipiti', prescribedSets: 3, repsTarget: '8-12/gamba', rpeTarget: '8', rest: "2'", unilateral: true },
    { id: 'gio-3', name: 'Romanian Deadlift (trap bar o DB)', muscle: 'Femorali', prescribedSets: 3, repsTarget: '8-10', rpeTarget: '7', rest: "2-3'" },
    { id: 'gio-4', name: 'Leg press piedi alti (focus glutei)', muscle: 'Glutei', prescribedSets: 3, repsTarget: '10-15', rpeTarget: '8', rest: "2'" },
    { id: 'gio-5', name: 'Cable hip abduction (gluteo medio)', muscle: 'Glutei', prescribedSets: 4, repsTarget: '12-15/lato', rpeTarget: '8-9', rest: '60"', unilateral: true },
    { id: 'gio-6', name: 'Back extension 45° (focus glutei)', muscle: 'Glutei', prescribedSets: 3, repsTarget: '10-15', rpeTarget: '8', rest: '90"' },
    { id: 'gio-7', name: 'Renegade row', muscle: 'Addome', prescribedSets: 3, repsTarget: '6-8/lato', rpeTarget: '8', rest: '90"', unilateral: true },
  ],
};

const SESSION_VEN: Session = {
  id: 'ven',
  day: 'venerdi',
  dayLabel: 'Venerdì',
  focus: 'Upper Pull + Braccia + Core',
  location: 'palestra',
  exercises: [
    { id: 'ven-1', name: 'Lat machine pronata (1.5x spalle)', muscle: 'Dorso', prescribedSets: 4, repsTarget: '8-10', rpeTarget: '7-8', rest: "2'" },
    { id: 'ven-2', name: 'Rematore manubri panca 30°', muscle: 'Dorso', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '8', rest: "2'" },
    { id: 'ven-3', name: 'Pulley basso impugnatura neutra', muscle: 'Dorso', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '8', rest: '90"' },
    { id: 'ven-4', name: 'Face pull cavi alti (corda)', muscle: 'Spalle', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8-9', rest: '60"' },
    { id: 'ven-5', name: 'Curl manubri panca inclinata 30°', muscle: 'Bicipiti', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '8', rest: '90"' },
    { id: 'ven-6', name: 'Hammer curl manubri', muscle: 'Bicipiti', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '8', rest: '75"' },
    { id: 'ven-7', name: 'Skull crusher EZ', muscle: 'Tricipiti', prescribedSets: 3, repsTarget: '10-12', rpeTarget: '8', rest: '90"' },
    { id: 'ven-8', name: 'Single-arm farmer carry (KB pesante)', muscle: 'Addome', prescribedSets: 3, repsTarget: '30-40m/lato', rpeTarget: '8', rest: '90"', unilateral: true, metric: 'meters' },
    { id: 'ven-9', name: 'Pallof press half-kneeling', muscle: 'Addome', prescribedSets: 3, repsTarget: '10/lato', rpeTarget: '8', rest: '60"', unilateral: true },
  ],
};

const SESSION_SAB: Session = {
  id: 'sab',
  day: 'sabato',
  dayLabel: 'Sabato',
  focus: 'Upper Push + Core completo',
  location: 'casa',
  exercises: [
    { id: 'sab-1', name: 'Push-up zavorrato (vest 10kg)', muscle: 'Petto', prescribedSets: 4, repsTarget: '8-12', rpeTarget: '8', rest: '90"' },
    { id: 'sab-2', name: 'Deficit push-up (mani su DB)', muscle: 'Petto', prescribedSets: 3, repsTarget: '8-12', rpeTarget: '8', rest: '90"' },
    { id: 'sab-3', name: 'Pike push-up', muscle: 'Spalle', prescribedSets: 3, repsTarget: '8-12', rpeTarget: '8', rest: '75"' },
    { id: 'sab-4', name: 'Floor press manubri', muscle: 'Petto', prescribedSets: 3, repsTarget: '10-15', rpeTarget: '8', rest: '90"' },
    { id: 'sab-5', name: 'Croci con elastico (chest fly)', muscle: 'Petto', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8-9', rest: '60"' },
    { id: 'sab-6', name: 'Alzate laterali manubri', muscle: 'Spalle', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8-9', rest: '60"' },
    { id: 'sab-7', name: 'Curl manubri', muscle: 'Bicipiti', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8', rest: '60"' },
    { id: 'sab-8', name: 'Pushdown con elastico', muscle: 'Tricipiti', prescribedSets: 3, repsTarget: '12-15', rpeTarget: '8-9', rest: '60"' },
    { id: 'sab-9', name: 'Stir-the-pot con ab wheel', muscle: 'Addome', prescribedSets: 3, repsTarget: '8-10/dir', rpeTarget: '8', rest: '75"' },
    { id: 'sab-10', name: 'Suitcase carry (DB 12.5kg o KB)', muscle: 'Addome', prescribedSets: 3, repsTarget: '40m/lato', rpeTarget: '8', rest: '75"', unilateral: true, metric: 'meters' },
  ],
};

export const BASE_SESSIONS: Session[] = [
  SESSION_LUN,
  SESSION_MAR,
  SESSION_GIO,
  SESSION_VEN,
  SESSION_SAB,
];

// -------------------------------------------------------------------
// DELOAD TRANSFORM (settimana 5)
// -------------------------------------------------------------------

function makeDeloadSessions(sessions: Session[]): Session[] {
  return sessions.map(s => ({
    ...s,
    exercises: s.exercises.map(e => ({
      ...e,
      prescribedSets: Math.max(e.prescribedSets - 1, 2),
      rpeTarget: '5-6',
    })),
  }));
}

// -------------------------------------------------------------------
// PROGRAMMA COMPLETO
// -------------------------------------------------------------------

export const WEEKS: Week[] = [
  { number: 1, label: 'Settimana 1', isDeload: false, sessions: BASE_SESSIONS },
  { number: 2, label: 'Settimana 2', isDeload: false, sessions: BASE_SESSIONS },
  { number: 3, label: 'Settimana 3', isDeload: false, sessions: BASE_SESSIONS },
  { number: 4, label: 'Settimana 4', isDeload: false, sessions: BASE_SESSIONS },
  { number: 5, label: 'Settimana 5 (Deload)', isDeload: true, sessions: makeDeloadSessions(BASE_SESSIONS) },
];

export const TOTAL_WEEKS = WEEKS.length;

export const MUSCLES: Muscle[] = [
  'Petto',
  'Dorso',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Glutei',
  'Quadricipiti',
  'Femorali',
  'Addome',
];

// -------------------------------------------------------------------
// HELPER PUBBLICI
// -------------------------------------------------------------------

const JS_DAY_TO_KEY: DayKey[] = [
  'domenica',
  'lunedi',
  'martedi',
  'mercoledi',
  'giovedi',
  'venerdi',
  'sabato',
];

export function getDayKeyFromDate(date: Date): DayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

export function getWeek(weekNumber: number): Week | undefined {
  return WEEKS.find(w => w.number === weekNumber);
}

export function getSession(weekNumber: number, day: DayKey): Session | undefined {
  return getWeek(weekNumber)?.sessions.find(s => s.day === day);
}

export function findExercise(
  weekNumber: number,
  exerciseId: string,
): { session: Session; exercise: Exercise } | undefined {
  const week = getWeek(weekNumber);
  if (!week) return undefined;
  for (const session of week.sessions) {
    const exercise = session.exercises.find(e => e.id === exerciseId);
    if (exercise) return { session, exercise };
  }
  return undefined;
}

export function getAllExercises(): Exercise[] {
  return BASE_SESSIONS.flatMap(s => s.exercises);
}

export function getMuscleMap(): Record<string, Muscle> {
  const map: Record<string, Muscle> = {};
  for (const session of BASE_SESSIONS) {
    for (const exercise of session.exercises) {
      map[exercise.id] = exercise.muscle;
    }
  }
  return map;
}

export function getCurrentWeekNumber(startDateISO: string, today: Date = new Date()): number {
  const start = new Date(startDateISO);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(week, 1), TOTAL_WEEKS);
}
