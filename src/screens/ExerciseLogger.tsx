// src/screens/ExerciseLogger.tsx
// Route: /esercizio/:weekNumber/:sessionId/:exerciseId

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, Info, StickyNote, Timer, Plus, Trash2, Trophy, Flame,
} from 'lucide-react';

import { useProgramData }   from '../hooks/useProgramData';
import { BackgroundPicker }  from '../components/BackgroundPicker';
import { Sparkline }         from '../components/Sparkline';
import type { Muscle }      from '../data/program';
import { useLogStore }      from '../hooks/useLogStore';
import { useToast }         from '../hooks/useToast';
import { useRestTimer }     from '../hooks/useRestTimer';
import { useWakeLock }      from '../hooks/useWakeLock';
import { useAutoRest }      from '../hooks/useAutoRest';
import { usePref }          from '../lib/prefs';
import { ToastStack }       from '../components/Toast';
import { today, formatDisplay } from '../lib/dates';
import { timerRestSeconds, formatClock } from '../lib/restTime';
import {
  exerciseHistory, recordsFromHistory, lastPerformance, bestOfSets,
} from '../lib/records';
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
  // onClick (non onPointerDown): un gesto di scroll non produce un click, quindi
  // scorrendo non si incrementano più reps/kg per errore.
  return (
    <button
      type="button"
      onClick={onPress}
      className={[
        'flex items-center justify-center rounded-xl select-none shrink-0',
        'active:scale-95 transition-transform font-bold',
        variant === 'primary'
          ? 'w-12 h-12 text-xl text-[var(--sl-cyan-soft)] border border-[var(--sl-line)] bg-[rgba(56,225,255,0.08)] active:bg-[rgba(56,225,255,0.18)]'
          : 'w-10 h-10 text-xs text-[var(--sl-text-dim)] border border-[var(--sl-line-soft)] bg-[rgba(56,225,255,0.04)] active:bg-[rgba(56,225,255,0.12)]',
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

  // Layout orizzontale con i bottoni −/+ ancorati a SINISTRA (lontani dal
  // pollice destro durante lo scroll). Il valore è subito dopo, il lato destro
  // resta libero. Il micro-step (±) sta su una riga secondaria per non sforare.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-11 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <StepBtn
          label="−"
          onPress={() => syncInput(clamp(roundToStep(value - step, step), min))}
        />
        <StepBtn
          label="+"
          onPress={() => syncInput(roundToStep(value + step, step))}
        />
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          defaultValue={value}
          onBlur={handleBlur}
          onFocus={e => e.currentTarget.select()}
          className={[
            'w-[68px] text-center text-2xl font-bold tabular-nums',
            'bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-xl py-1.5',
            // Contrasto AAA: text-white su bg scuro
            'text-white focus:outline-none focus:border-[var(--sl-cyan)] focus:shadow-[0_0_14px_var(--sl-glow)]',
            '[appearance:textfield]',
            '[&::-webkit-outer-spin-button]:appearance-none',
            '[&::-webkit-inner-spin-button]:appearance-none',
          ].join(' ')}
        />
      </div>

      {microStep !== undefined && (
        <div className="flex items-center gap-1.5 pl-[52px]">
          <StepBtn
            label={`−${microStep}`}
            onPress={() => syncInput(clamp(roundToStep(value - microStep, microStep), min))}
            variant="subtle"
          />
          <StepBtn
            label={`+${microStep}`}
            onPress={() => syncInput(roundToStep(value + microStep, microStep))}
            variant="subtle"
          />
          <span className="text-[10px] text-slate-600 ml-1">fine</span>
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
  const { getExerciseLog, saveExerciseLog, clearExerciseLog, getAllSessionLogs } = useLogStore();
  const { toasts, show } = useToast();
  const restTimer = useRestTimer();
  const [autoRest] = usePref('autoRest');
  const autoRestTimer = useAutoRest();
  const restedSets = useRef<Set<number>>(new Set());

  // Tiene lo schermo acceso durante il logging
  useWakeLock(true);

  const program    = useProgramData();
  const weekNumber = parseInt(wkStr ?? '1', 10);
  const dateISO    = today();
  const exId       = exerciseId ?? '';
  const sid        = sessionId ?? '';
  const found      = program.findExercise(weekNumber, exId);

  const existingLog = getExerciseLog(weekNumber, sid, dateISO, exId);

  // ── Storico, record, ultima prestazione (escludono la sessione corrente) ──────
  const sessionKey  = { weekNumber, sessionId: sid, date: dateISO };
  const allSessions = getAllSessionLogs();
  const history     = exerciseHistory(allSessions, exId, sessionKey);
  const prevRecords = recordsFromHistory(history);
  const lastPerf    = lastPerformance(allSessions, exId, sessionKey);

  // Pre-compila il CARICO dall'ultima volta (le reps restano da inserire),
  // solo se non c'è già un log di oggi e l'ultima volta aveva un carico > 0.
  const prefilledFromLast = !!found && !existingLog?.sets.length && !!lastPerf?.sets.some(s => s.kg > 0);

  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState<string>(existingLog?.notes ?? '');
  const [sets,  setSets]  = useState<SetLog[]>(() => {
    if (!found) return [];
    const n = found.exercise.prescribedSets;
    // 1) Log di oggi già presente → riprendilo
    if (existingLog?.sets.length) {
      const base = existingLog.sets.slice(0, n);
      while (base.length < n) base.push({ reps: 0, kg: 0 });
      return base;
    }
    // 2) Pre-compila SOLO il carico dall'ultima volta (reps da inserire a mano).
    //    Per i set extra ripete il carico dell'ultima serie.
    if (lastPerf?.sets.length) {
      const src = lastPerf.sets;
      return Array.from({ length: n }, (_, i) => {
        const s = src[i] ?? src[src.length - 1];
        return { reps: 0, kg: s.kg };
      });
    }
    // 3) Vuoto
    return Array.from({ length: n }, () => ({ reps: 0, kg: 0 }));
  });

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  // ── Autosave ───────────────────────────────────────────────────────────────────
  // Salva a ogni modifica DOPO la prima interazione: così i valori pre-compilati
  // dall'ultima volta NON vengono registrati come sessione "fantasma" se l'utente
  // apre e chiude senza fare nulla.
  useEffect(() => {
    if (!found || !dirty) return;
    const id = found.exercise.id;
    const hasData = sets.some(s => s.reps > 0);
    if (hasData) {
      saveExerciseLog(weekNumber, sid, dateISO, {
        exerciseId:  id,
        sets,
        completedAt: new Date().toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    } else if (getExerciseLog(weekNumber, sid, dateISO, id)) {
      clearExerciseLog(weekNumber, sid, dateISO, id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, notes, dirty]);

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
  const restSeconds   = timerRestSeconds(exercise.rest);

  function updateSet(idx: number, field: keyof SetLog, value: number) {
    markDirty();
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    // Avvio recupero automatico: alla prima volta che una serie ha reps > 0,
    // dopo una breve pausa (debounce) parte il timer di recupero.
    if (autoRest && field === 'reps' && value > 0 && !restedSets.current.has(idx)) {
      autoRestTimer.schedule(() => {
        restedSets.current.add(idx);
        restTimer.start(restSeconds, exercise.name);
        if ('vibrate' in navigator) navigator.vibrate(20);
      });
    }
  }

  function addSet() {
    markDirty();
    setSets(prev => [...prev, { reps: 0, kg: 0 }]);
  }

  function removeSet(idx: number) {
    markDirty();
    setSets(prev => prev.filter((_, i) => i !== idx));
    if ('vibrate' in navigator) navigator.vibrate(20);
  }

  function startRest() {
    autoRestTimer.cancel();
    restTimer.start(restSeconds, exercise.name);
    if ('vibrate' in navigator) navigator.vibrate(20);
  }

  function setVolume(s: SetLog): number {
    return parseFloat((s.reps * s.kg).toFixed(1));
  }

  const totalVolume = sets.reduce((acc, s) => acc + setVolume(s), 0);
  const canSave     = sets.some(s => s.reps > 0);

  // ── Record live (confronto con i massimi precedenti) ──────────────────────────
  const current  = bestOfSets(sets);
  const prWeight = prevRecords.maxKg > 0 && current.topKg > prevRecords.maxKg;
  const pr1rm    = prevRecords.maxE1rm > 0 && current.topE1rm > prevRecords.maxE1rm;
  const prVolume = prevRecords.maxVolume > 0 && current.volume > prevRecords.maxVolume;
  const isPR     = prWeight || pr1rm || prVolume;
  const prParts  = [
    prWeight ? 'peso' : null,
    pr1rm ? '1RM' : null,
    prVolume ? 'volume' : null,
  ].filter(Boolean).join(' · ');

  const trendPoints = history.map(e => e.volume).slice(-8);

  function handleSave() {
    if (!canSave) return;

    saveExerciseLog(weekNumber, sid, dateISO, {
      exerciseId:  exercise.id,
      sets,
      completedAt: new Date().toISOString(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });

    if ('vibrate' in navigator) navigator.vibrate(isPR ? [40, 40, 80] : 50);
    show(isPR ? '🔥 Nuovo record! Salvato ✓' : 'Allenamento salvato ✓', 'ok');

    setTimeout(() => navigate('/'), 700);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="px-4 pt-4 pb-5 space-y-5 max-w-lg mx-auto w-full">

        {/* Back + sfondo esercizio */}
        <div className="flex items-center justify-between -ml-1">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[var(--sl-text-dim)] active:text-slate-200
              py-2 pr-4 min-h-[48px]"
          >
            <ArrowLeft size={20} strokeWidth={2} />
            <span className="text-sm sl-label text-[10px]">Sessione</span>
          </button>

          <BackgroundPicker
            bgKey={`exercise:${exercise.id}`}
            label={exercise.name}
            compact
            onDone={a => show(a === 'set' ? 'Sfondo esercizio impostato ✓' : 'Sfondo rimosso', 'ok')}
          />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-snug text-white sl-glow-text" style={{ fontFamily: 'var(--font-ui)' }}>
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

          <p className="text-[var(--sl-text-dim)] text-sm">
            <span className="text-slate-200 font-medium">{exercise.prescribedSets} set</span>
            {' × '}
            <span className="text-slate-200 font-medium">{exercise.repsTarget} {metricLabel}</span>
            {exercise.unilateral && <span className="text-slate-500"> per lato</span>}
            {'  ·  '}RPE {exercise.rpeTarget}
            {'  ·  '}rec {exercise.rest}
          </p>

          {exercise.notes && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5
              bg-[rgba(56,225,255,0.06)] border border-[var(--sl-line-soft)]">
              <Info size={14} className="text-[var(--sl-cyan)] shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm italic">{exercise.notes}</p>
            </div>
          )}
        </div>

        {/* Pre-compilato dall'ultima volta */}
        {prefilledFromLast && !dirty && lastPerf && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5
            bg-[rgba(139,92,255,0.10)] border border-[rgba(139,92,255,0.3)]">
            <Info size={14} className="text-[var(--sl-violet-soft)] shrink-0 mt-0.5" />
            <p className="text-slate-300 text-sm">
              Carico pre-compilato dall'ultima volta
              <span className="text-slate-500"> ({formatDisplay(lastPerf.date)})</span>.
              Inserisci le ripetizioni.
            </p>
          </div>
        )}

        {/* Record personali + andamento */}
        {prevRecords.sessions > 0 && (
          <div className="sl-panel rounded-2xl px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 sl-label text-[10px] text-[var(--sl-text-dim)]">
                <Trophy size={13} className="text-amber-400" /> Record personale
              </span>
              {trendPoints.length >= 2 && (
                <Sparkline points={trendPoints} width={92} height={26} />
              )}
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              {prevRecords.maxKg > 0 && (
                <span className="text-slate-300">
                  Max <span className="text-white font-bold tabular-nums">{prevRecords.maxKg}</span> kg
                </span>
              )}
              {prevRecords.maxE1rm > 0 && (
                <span className="text-slate-300">
                  1RM stim. <span className="text-white font-bold tabular-nums">{Math.round(prevRecords.maxE1rm)}</span> kg
                </span>
              )}
              <span className="text-slate-500 text-xs">
                {prevRecords.sessions} session{prevRecords.sessions === 1 ? 'e' : 'i'}
              </span>
            </div>
          </div>
        )}

        {/* Badge nuovo record (live) */}
        {isPR && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5
            bg-amber-500/15 border border-amber-500/50 sl-pulse">
            <Flame size={18} className="text-amber-400 shrink-0" />
            <p className="text-amber-200 text-sm font-semibold">
              Nuovo record in arrivo! <span className="font-normal text-amber-300/80">({prParts})</span>
            </p>
          </div>
        )}

        {/* Set cards */}
        <div className="space-y-3">
          {sets.map((s, idx) => {
            const vol     = setVolume(s);
            const isDone  = s.reps > 0;
            const lastSet = lastPerf?.sets[idx];

            return (
              <div
                key={idx}
                className={[
                  'sl-panel rounded-2xl px-4 pt-3 pb-4 space-y-3 transition-shadow',
                  isDone ? 'ring-1 ring-[var(--sl-cyan)]/45 shadow-[0_0_18px_rgba(56,225,255,0.12)]' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className={[
                    'sl-label text-[11px]',
                    isDone ? 'text-[var(--sl-cyan-soft)]' : 'text-[var(--sl-text-dim)]',
                  ].join(' ')}>
                    Set {idx + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    {vol > 0 && (
                      <span className="text-xs text-[var(--sl-text-dim)] tabular-nums">
                        Vol: <span className="text-white font-semibold">{vol}</span> kg
                      </span>
                    )}
                    {sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSet(idx)}
                        aria-label={`Rimuovi set ${idx + 1}`}
                        className="flex items-center justify-center w-8 h-8 -mr-1 rounded-lg
                          text-slate-500 active:text-rose-300 active:bg-rose-900/40"
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <NumField
                    label={metricLabel}
                    value={s.reps}
                    step={1}
                    min={0}
                    onChange={v => updateSet(idx, 'reps', v)}
                  />
                  <NumField
                    label="kg"
                    value={s.kg}
                    step={kgStep}
                    microStep={kgMicro}
                    min={0}
                    onChange={v => updateSet(idx, 'kg', v)}
                  />
                </div>

                {/* Riferimento ultima volta + avvio recupero */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  {lastSet && (lastSet.reps > 0 || lastSet.kg > 0) ? (
                    <span className="text-[11px] text-[var(--sl-text-dim)] tabular-nums">
                      ↩ ultima: <span className="text-slate-400">{lastSet.reps} × {lastSet.kg}</span>
                    </span>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={startRest}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-lg shrink-0
                      text-[var(--sl-cyan-soft)] text-xs font-semibold
                      border border-[var(--sl-line)] bg-[rgba(56,225,255,0.06)] active:bg-[rgba(56,225,255,0.16)]"
                  >
                    <Timer size={14} strokeWidth={2.25} />
                    Riposo {formatClock(restSeconds)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Aggiungi serie */}
        <button
          type="button"
          onClick={addSet}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl min-h-[48px]
            text-[var(--sl-text-dim)] text-sm font-semibold
            border border-dashed border-[var(--sl-line)] bg-[rgba(56,225,255,0.03)]
            active:bg-[rgba(56,225,255,0.1)] active:text-[var(--sl-cyan-soft)]"
        >
          <Plus size={18} strokeWidth={2.5} />
          Aggiungi serie
        </button>

        {/* Note libere */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 sl-label text-[10px] text-[var(--sl-text-dim)]">
            <StickyNote size={12} />
            Note (opzionale)
          </label>
          <textarea
            value={notes}
            onChange={e => { markDirty(); setNotes(e.target.value); }}
            placeholder="Come ti sei sentito? Carico, tecnica, sensazioni…"
            rows={3}
            className="w-full bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-xl px-3 py-2.5
              text-slate-200 text-sm placeholder:text-[var(--sl-text-dim)]
              focus:outline-none focus:border-[var(--sl-cyan)] resize-none"
          />
        </div>

        {/* Volume totale */}
        {totalVolume > 0 && (
          <div className="sl-panel rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="sl-label text-[10px] text-[var(--sl-text-dim)]">Volume totale</span>
            <span className="text-xl font-bold text-white tabular-nums sl-display">
              {totalVolume.toFixed(1)}
              <span className="text-sm font-normal text-[var(--sl-text-dim)] ml-1">kg</span>
            </span>
          </div>
        )}

        {/* Bottone Salva — sticky in fondo */}
        <div className="sticky bottom-3 z-10 pt-4 -mb-1
          bg-gradient-to-t from-[var(--sl-bg)] via-[var(--sl-bg)]/85 to-transparent">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="sl-btn w-full flex items-center justify-center gap-2
              py-4 rounded-2xl text-base min-h-[56px]"
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
