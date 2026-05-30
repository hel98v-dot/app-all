// src/screens/ExerciseLogger.tsx
// Route: /esercizio/:weekNumber/:sessionId/:exerciseId

import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Info } from 'lucide-react';

import { findExercise }     from '../data/program';
import type { Muscle }      from '../data/program';
import { useLogStore }      from '../hooks/useLogStore';
import { useToast }         from '../hooks/useToast';
import { ToastStack }       from '../components/Toast';
import { today }            from '../lib/dates';
import type { SetLog }      from '../types';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(val: number, min: number): number {
  return Math.max(min, val);
}

function roundToStep(val: number, step: number): number {
  return Math.round(val / step) * step;
}

// ── StepBtn ───────────────────────────────────────────────────────────────────

interface StepBtnProps {
  label:    string;
  onPress:  () => void;
  variant?: 'primary' | 'subtle';
}

function StepBtn({ label, onPress, variant = 'primary' }: StepBtnProps) {
  return (
    <button
      type="button"
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      className={[
        'flex items-center justify-center w-12 h-12 rounded-xl select-none',
        'active:scale-95 transition-transform font-bold',
        variant === 'primary'
          ? 'bg-slate-700 text-xl text-slate-100 active:bg-slate-600'
          : 'bg-slate-800 text-sm  text-slate-400 active:bg-slate-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── NumField — input semi-uncontrolled ────────────────────────────────────────
// L'input è "uncontrolled" (usa defaultValue + ref) per evitare l'ESLint warning
// di set-state-in-effect. I bottoni +/− aggiornano il DOM direttamente via ref.

interface NumFieldProps {
  value:       number;
  onChange:    (v: number) => void;
  step:        number;
  min?:        number;
  label:       string;
  microStep?:  number;
}

function NumField({ value, onChange, step, min = 0, label, microStep }: NumFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function syncInput(newVal: number) {
    if (inputRef.current) inputRef.current.value = String(newVal);
    onChange(newVal);
  }

  function handleBlur() {
    const raw = inputRef.current?.value ?? '';
    const n   = parseFloat(raw);
    if (!isNaN(n) && n >= min) {
      const clamped = clamp(n, min);
      if (inputRef.current) inputRef.current.value = String(clamped);
      onChange(clamped);
    } else if (inputRef.current) {
      inputRef.current.value = String(value);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>

      <div className="flex items-center gap-2">
        <StepBtn
          label="−"
          onPress={() => syncInput(clamp(roundToStep(value - step, step), min))}
        />
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          defaultValue={value}
          onBlur={handleBlur}
          onFocus={e => e.currentTarget.select()}
          className={[
            'w-[72px] text-center text-2xl font-bold tabular-nums',
            'bg-slate-900 border border-slate-700 rounded-xl py-2',
            // Contrasto AAA: text-white su bg scuro
            'text-white focus:outline-none focus:border-indigo-400',
            '[appearance:textfield]',
            '[&::-webkit-outer-spin-button]:appearance-none',
            '[&::-webkit-inner-spin-button]:appearance-none',
          ].join(' ')}
        />
        <StepBtn
          label="+"
          onPress={() => syncInput(roundToStep(value + step, step))}
        />
      </div>

      {microStep !== undefined && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <StepBtn
            label={`−${microStep}`}
            onPress={() => syncInput(clamp(roundToStep(value - microStep, microStep), min))}
            variant="subtle"
          />
          <span className="text-[10px] text-slate-600 w-8 text-center">micro</span>
          <StepBtn
            label={`+${microStep}`}
            onPress={() => syncInput(roundToStep(value + microStep, microStep))}
            variant="subtle"
          />
        </div>
      )}
    </div>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────

export function ExerciseLogger() {
  const { weekNumber: wkStr, sessionId, exerciseId } = useParams<{
    weekNumber:  string;
    sessionId:   string;
    exerciseId:  string;
  }>();
  const navigate = useNavigate();
  const { getExerciseLog, saveExerciseLog } = useLogStore();
  const { toasts, show } = useToast();

  const weekNumber = parseInt(wkStr ?? '1', 10);
  const dateISO    = today();
  const found      = findExercise(weekNumber, exerciseId ?? '');

  const existingLog = getExerciseLog(weekNumber, sessionId ?? '', dateISO, exerciseId ?? '');

  const [sets, setSets] = useState<SetLog[]>(() => {
    if (!found) return [];
    const n    = found.exercise.prescribedSets;
    if (existingLog?.sets.length) {
      const base = existingLog.sets.slice(0, n);
      while (base.length < n) base.push({ reps: 0, kg: 0 });
      return base;
    }
    return Array.from({ length: n }, () => ({ reps: 0, kg: 0 }));
  });

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (!found) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
        <Info size={40} className="text-slate-600" />
        <p className="text-slate-400">Esercizio non trovato.</p>
        <button
          onClick={() => navigate('/')}
          className="text-indigo-400 underline text-sm min-h-[48px]"
        >
          Torna alla sessione
        </button>
      </div>
    );
  }

  const { exercise }  = found;
  const isMeters      = exercise.metric === 'meters';
  const metricLabel   = isMeters ? 'metri' : 'reps';
  const kgStep        = 2.5;
  const kgMicro       = 0.5;

  function updateSet(idx: number, field: keyof SetLog, value: number) {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function setVolume(s: SetLog): number {
    return parseFloat((s.reps * s.kg).toFixed(1));
  }

  const totalVolume = sets.reduce((acc, s) => acc + setVolume(s), 0);
  // Salva abilitato SOLO se almeno 1 set ha reps > 0
  const canSave = sets.some(s => s.reps > 0);

  function handleSave() {
    if (!canSave) return;

    saveExerciseLog(weekNumber, sessionId ?? '', dateISO, {
      exerciseId:  exercise.id,
      sets,
      completedAt: new Date().toISOString(),
    });

    if ('vibrate' in navigator) navigator.vibrate(50);
    show('Allenamento salvato ✓', 'ok');

    // Torna indietro dopo breve delay per far vedere il toast
    setTimeout(() => navigate('/'), 700);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col min-h-full">

        <div className="flex-1 px-4 pt-4 pb-36 space-y-5 max-w-lg mx-auto w-full">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-400 active:text-slate-200
              -ml-1 py-2 pr-4 min-h-[48px]"
          >
            <ArrowLeft size={20} strokeWidth={2} />
            <span className="text-sm">Sessione</span>
          </button>

          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-snug text-white">
              {exercise.name}
              {exercise.unilateral && (
                <span className="text-slate-400 font-normal text-lg ml-2">(per lato)</span>
              )}
            </h1>

            <span className={[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
              MUSCLE_COLORS[exercise.muscle],
            ].join(' ')}>
              {exercise.muscle}
            </span>

            <p className="text-slate-400 text-sm">
              <span className="text-slate-200 font-medium">{exercise.prescribedSets} set</span>
              {' × '}
              <span className="text-slate-200 font-medium">{exercise.repsTarget} {metricLabel}</span>
              {exercise.unilateral && <span className="text-slate-500"> per lato</span>}
              {'  ·  '}RPE {exercise.rpeTarget}
              {'  ·  '}rec {exercise.rest}
            </p>

            {exercise.notes && (
              <div className="flex items-start gap-2 bg-slate-800/60 rounded-xl px-3 py-2.5">
                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-slate-300 text-sm italic">{exercise.notes}</p>
              </div>
            )}
          </div>

          {/* Set cards */}
          <div className="space-y-3">
            {sets.map((s, idx) => {
              const vol    = setVolume(s);
              const isDone = s.reps > 0;

              return (
                <div
                  key={idx}
                  className={[
                    'rounded-2xl border px-4 pt-3 pb-4 space-y-3',
                    isDone
                      ? 'bg-indigo-950/40 border-indigo-700/50'
                      : 'bg-slate-800     border-slate-700/60',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className={[
                      'text-xs font-bold uppercase tracking-widest',
                      isDone ? 'text-indigo-400' : 'text-slate-500',
                    ].join(' ')}>
                      Set {idx + 1}
                    </span>
                    {vol > 0 && (
                      <span className="text-xs text-slate-400 tabular-nums">
                        Vol: <span className="text-white font-semibold">{vol}</span> kg
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-center gap-6 flex-wrap">
                    <NumField
                      label={metricLabel}
                      value={s.reps}
                      step={1}
                      min={0}
                      onChange={v => updateSet(idx, 'reps', v)}
                    />
                    <div className="flex items-center self-center pt-5">
                      <span className="text-slate-600 text-xl font-light">×</span>
                    </div>
                    <NumField
                      label="kg"
                      value={s.kg}
                      step={kgStep}
                      microStep={kgMicro}
                      min={0}
                      onChange={v => updateSet(idx, 'kg', v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Volume totale */}
          {totalVolume > 0 && (
            <div className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3
              flex items-center justify-between">
              <span className="text-slate-400 text-sm">Volume totale esercizio</span>
              <span className="text-xl font-bold text-white tabular-nums">
                {totalVolume.toFixed(1)}
                <span className="text-sm font-normal text-slate-400 ml-1">kg</span>
              </span>
            </div>
          )}
        </div>

        {/* Bottone Salva sticky */}
        <div className="fixed bottom-[56px] inset-x-0 px-4 pb-3
          bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-4">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={[
              'w-full max-w-lg mx-auto flex items-center justify-center gap-2',
              'py-4 rounded-2xl text-base font-bold min-h-[56px]',
              'transition-all active:scale-[0.97]',
              canSave
                ? 'bg-indigo-600 active:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed',
            ].join(' ')}
          >
            <Check size={20} strokeWidth={2.5} />
            {canSave ? 'Salva allenamento' : 'Inserisci almeno 1 set con reps'}
          </button>
        </div>
      </div>

      <ToastStack toasts={toasts} />
    </>
  );
}
