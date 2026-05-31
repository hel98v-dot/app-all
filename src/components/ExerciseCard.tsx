// src/components/ExerciseCard.tsx
// Card esercizio nella schermata Oggi.
// Touch target generoso, info prescrizione compatta, stato completamento visibile.
// Bottone reset (cestino) con doppio tap di conferma per evitare cancellazioni accidentali.

import { useState }                        from 'react';
import { CheckCircle2, ChevronRight, Circle, Trash2, AlertCircle } from 'lucide-react';
import type { Exercise, Muscle }           from '../data/program';
import type { ExerciseLog }                from '../types';

// ── Colori badge muscolo ──────────────────────────────────────────────────────
const MUSCLE_COLORS: Record<Muscle, string> = {
  Petto:        'bg-blue-900/70   text-blue-300   border-blue-700/50',
  Dorso:        'bg-cyan-900/70   text-cyan-300   border-cyan-700/50',
  Spalle:       'bg-violet-900/70 text-violet-300 border-violet-700/50',
  Bicipiti:     'bg-pink-900/70   text-pink-300   border-pink-700/50',
  Tricipiti:    'bg-purple-900/70 text-purple-300 border-purple-700/50',
  Glutei:       'bg-rose-900/70   text-rose-300   border-rose-700/50',
  Quadricipiti: 'bg-orange-900/70 text-orange-300 border-orange-700/50',
  Femorali:     'bg-amber-900/70  text-amber-300  border-amber-700/50',
  Addome:       'bg-teal-900/70   text-teal-300   border-teal-700/50',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface ExerciseCardProps {
  exercise: Exercise;
  /** Log odierno dell'esercizio, undefined se non ancora loggato. */
  log: ExerciseLog | undefined;
  onClick:  () => void;
  /** Chiamata dopo la conferma del reset. */
  onReset?: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function ExerciseCard({ exercise, log, onClick, onReset }: ExerciseCardProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const setsLogged = log?.sets.length ?? 0;
  const isDone     = setsLogged >= exercise.prescribedSets;
  const hasPartial = setsLogged > 0 && !isDone;
  const hasLog     = setsLogged > 0;

  const metricLabel  = exercise.metric === 'meters' ? 'metri' : 'reps';
  const prescription =
    `${exercise.prescribedSets} set × ${exercise.repsTarget} ${metricLabel}` +
    `  @  RPE ${exercise.rpeTarget},  rec ${exercise.rest}`;

  // Primo tap: entra in modalità conferma
  // Secondo tap: esegue il reset
  // Tap fuori dalla card: annulla (gestito da onBlur/onClick della card stessa)
  function handleResetTap(e: React.MouseEvent) {
    e.stopPropagation(); // non aprire l'ExerciseLogger
    if (!confirmReset) {
      setConfirmReset(true);
      // Auto-annulla dopo 3 secondi se l'utente non conferma
      setTimeout(() => setConfirmReset(false), 3000);
    } else {
      setConfirmReset(false);
      onReset?.();
      if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]);
    }
  }

  return (
    <div className="relative">
      {/* ── Card principale (bottone navigazione) ─────────────────────────── */}
      <button
        onClick={() => { setConfirmReset(false); onClick(); }}
        className={[
          'w-full text-left rounded-2xl px-4 py-5 flex items-start gap-4',
          'transition-all active:scale-[0.985] active:brightness-110',
          confirmReset
            ? 'border bg-rose-950/50 border-rose-700/60'
            : isDone
              ? 'border bg-emerald-950/45 border-emerald-600/50 shadow-[0_0_16px_rgba(16,185,129,0.12)]'
              : 'sl-panel',
          // Spazio a destra per il bottone reset (quando il log esiste)
          hasLog ? 'pr-14' : '',
        ].join(' ')}
      >
        {/* Icona stato */}
        <div className="mt-0.5 shrink-0">
          {isDone ? (
            <CheckCircle2 size={26} className="text-emerald-400" strokeWidth={2} />
          ) : hasPartial ? (
            <Circle size={26} className="text-[var(--sl-cyan)]" strokeWidth={2} />
          ) : (
            <Circle size={26} className="text-slate-600" strokeWidth={1.75} />
          )}
        </div>

        {/* Contenuto */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <span className={[
              'text-[17px] font-bold leading-snug',
              confirmReset ? 'text-rose-300' : isDone ? 'text-emerald-200' : 'text-slate-50',
            ].join(' ')}>
              {exercise.name}
            </span>
            {exercise.unilateral && (
              <span className="text-xs text-slate-400 font-normal self-center">(per lato)</span>
            )}
          </div>

          <span className={[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
            MUSCLE_COLORS[exercise.muscle],
          ].join(' ')}>
            {exercise.muscle}
          </span>

          <p className="text-sm text-slate-400 leading-snug">{prescription}</p>

          {exercise.notes && (
            <p className="text-xs text-slate-500 italic">{exercise.notes}</p>
          )}

          {/* Messaggio conferma reset inline */}
          {confirmReset && (
            <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
              <AlertCircle size={12} />
              Tocca di nuovo il cestino per confermare
            </p>
          )}
        </div>

        {/* Contatore set + freccia */}
        <div className="shrink-0 flex flex-col items-end justify-between self-stretch">
          {setsLogged > 0 && (
            <span className={[
              'text-[15px] font-bold tabular-nums',
              confirmReset ? 'text-rose-400' : isDone ? 'text-emerald-400' : 'text-[var(--sl-cyan)]',
            ].join(' ')}>
              {setsLogged}/{exercise.prescribedSets}
            </span>
          )}
          <ChevronRight
            size={20}
            strokeWidth={2}
            className={isDone ? 'text-emerald-600' : 'text-slate-600'}
          />
        </div>
      </button>

      {/* ── Bottone reset — sovrapposto in alto a destra ───────────────────── */}
      {hasLog && onReset && (
        <button
          onClick={handleResetTap}
          aria-label={confirmReset ? 'Conferma reset' : 'Ripristina esercizio'}
          className={[
            // Touch target 48×48px
            'absolute top-1/2 right-3 -translate-y-1/2',
            'flex items-center justify-center w-12 h-12 rounded-xl',
            'transition-all',
            confirmReset
              ? 'bg-rose-600 text-white scale-110'
              : 'bg-slate-700/80 text-slate-400 active:bg-rose-800 active:text-rose-200',
          ].join(' ')}
        >
          {confirmReset
            ? <Trash2 size={18} strokeWidth={2.5} />
            : <Trash2 size={16} strokeWidth={2} />
          }
        </button>
      )}
    </div>
  );
}
