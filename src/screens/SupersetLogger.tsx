// src/screens/SupersetLogger.tsx
// Route: /superset/:weekNumber/:sessionId/:ids   (ids = "idA,idB")
// Logging combinato di un superset: i due esercizi a serie alternate per "giri",
// così non serve aprire/chiudere di continuo i due esercizi.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Info, Timer, Link2 } from 'lucide-react';

import { useProgramData } from '../hooks/useProgramData';
import { useLogStore }    from '../hooks/useLogStore';
import { useRestTimer }   from '../hooks/useRestTimer';
import { useWakeLock }    from '../hooks/useWakeLock';
import { useAutoRest }    from '../hooks/useAutoRest';
import { usePref }        from '../lib/prefs';
import { useToast }       from '../hooks/useToast';
import { ToastStack }     from '../components/Toast';
import { today }          from '../lib/dates';
import { timerRestSeconds, formatClock } from '../lib/restTime';
import { lastPerformance } from '../lib/records';
import { getActiveScheduleId } from '../lib/schedules';
import type { Exercise }  from '../data/program';
import type { ExerciseLog, SetLog } from '../types';

// ── Stepper compatto (onClick, niente incrementi durante lo scroll) ───────────
function clamp(v: number, m: number): number { return Math.max(m, v); }
function roundToStep(v: number, s: number): number { return Math.round(v / s) * s; }

function MiniStepper({ value, onChange, step, min = 0 }: {
  value: number; onChange: (v: number) => void; step: number; min?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const sync = (n: number) => { if (ref.current) ref.current.value = String(n); onChange(n); };
  const blur = () => {
    const n = parseFloat(ref.current?.value ?? '');
    if (!isNaN(n) && n >= min) { const c = clamp(n, min); if (ref.current) ref.current.value = String(c); onChange(c); }
    else if (ref.current) ref.current.value = String(value);
  };
  const btn = 'w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold shrink-0 active:scale-95 transition-transform text-[var(--sl-cyan-soft)] border border-[var(--sl-line)] bg-[rgba(56,225,255,0.08)] active:bg-[rgba(56,225,255,0.18)]';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => sync(clamp(roundToStep(value - step, step), min))}>−</button>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        defaultValue={value}
        onBlur={blur}
        onFocus={e => e.currentTarget.select()}
        className="w-[58px] text-center text-xl font-bold tabular-nums bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-lg py-1 text-white focus:outline-none focus:border-[var(--sl-cyan)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => sync(roundToStep(value + step, step))}>+</button>
    </div>
  );
}

// ── Init set di un esercizio (pre-compila SOLO il kg dall'ultima volta) ───────
function initSets(ex: Exercise, existing: ExerciseLog | undefined, lastSets: SetLog[] | undefined): SetLog[] {
  const n = ex.prescribedSets;
  if (existing?.sets.length) {
    const base = existing.sets.slice(0, n);
    while (base.length < n) base.push({ reps: 0, kg: 0 });
    return base;
  }
  if (lastSets?.length) {
    return Array.from({ length: n }, (_, i) => ({ reps: 0, kg: (lastSets[i] ?? lastSets[lastSets.length - 1]).kg }));
  }
  return Array.from({ length: n }, () => ({ reps: 0, kg: 0 }));
}

export function SupersetLogger() {
  const { weekNumber: wkStr, sessionId, ids } = useParams<{ weekNumber: string; sessionId: string; ids: string }>();
  const navigate = useNavigate();
  const program = useProgramData();
  const { getExerciseLog, getSessionLog, saveSessionLog, getAllSessionLogs } = useLogStore();
  const restTimer = useRestTimer();
  const { toasts, show } = useToast();
  const [autoRest] = usePref('autoRest');
  const autoRestTimer = useAutoRest();
  const restedSets = useRef<Set<string>>(new Set());
  useWakeLock(true);

  const weekNumber = parseInt(wkStr ?? '1', 10);
  const sid = sessionId ?? '';
  const dateISO = today();
  const exIds = (ids ?? '').split(',').filter(Boolean);

  const found: Exercise[] = exIds
    .map(id => program.findExercise(weekNumber, id)?.exercise)
    .filter((e): e is Exercise => !!e);

  const allSessions = getAllSessionLogs();
  const sessionKey = { weekNumber, sessionId: sid, date: dateISO };
  const meta = found.map(ex => ({
    ex,
    last: lastPerformance(allSessions, ex.id, sessionKey),
  }));

  const [dirty, setDirty] = useState(false);
  const [setsMap, setSetsMap] = useState<Record<string, SetLog[]>>(() => {
    const m: Record<string, SetLog[]> = {};
    for (const ex of found) {
      m[ex.id] = initSets(ex, getExerciseLog(weekNumber, sid, dateISO, ex.id), lastPerformance(allSessions, ex.id, sessionKey)?.sets);
    }
    return m;
  });

  const markDirty = () => { if (!dirty) setDirty(true); };

  // Salvataggio ATOMICO di tutti gli esercizi del superset in un'unica sessione.
  // (Chiamare saveExerciseLog in loop li sovrascriverebbe: ogni chiamata parte
  //  dallo stesso store "stale" del render corrente.)
  function persistAll(): void {
    const existing = getSessionLog(weekNumber, sid, dateISO);
    const base = existing ?? {
      id: crypto.randomUUID(), weekNumber, sessionId: sid, date: dateISO,
      exercises: [] as ExerciseLog[], scheduleId: getActiveScheduleId(),
    };
    let exercises = [...base.exercises];
    for (const ex of found) {
      const sets = setsMap[ex.id] ?? [];
      const idx = exercises.findIndex(e => e.exerciseId === ex.id);
      if (sets.some(s => s.reps > 0)) {
        const log: ExerciseLog = { exerciseId: ex.id, sets, completedAt: new Date().toISOString() };
        exercises = idx === -1 ? [...exercises, log] : exercises.map((e, i) => (i === idx ? log : e));
      } else if (idx !== -1) {
        exercises = exercises.filter(e => e.exerciseId !== ex.id);
      }
    }
    saveSessionLog({ ...base, exercises });
  }

  // Autosave dopo la prima interazione (i kg pre-compilati non creano log fantasma)
  useEffect(() => {
    if (dirty) persistAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsMap, dirty]);

  if (found.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
        <Info size={40} className="text-slate-600" />
        <p className="text-slate-400">Superset non trovato.</p>
        <button onClick={() => navigate('/')} className="text-indigo-400 underline text-sm min-h-[48px]">Torna alla sessione</button>
      </div>
    );
  }

  const rounds = Math.max(...found.map(e => e.prescribedSets));
  const restSeconds = Math.max(...found.map(e => timerRestSeconds(e.rest)));

  function updateSet(exId: string, idx: number, field: keyof SetLog, value: number) {
    markDirty();
    setSetsMap(prev => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
    const key = `${exId}:${idx}`;
    if (autoRest && field === 'reps' && value > 0 && !restedSets.current.has(key)) {
      autoRestTimer.schedule(() => {
        restedSets.current.add(key);
        restTimer.start(restSeconds, 'Superset');
        if ('vibrate' in navigator) navigator.vibrate(20);
      });
    }
  }

  function startRest() {
    autoRestTimer.cancel();
    restTimer.start(restSeconds, 'Superset');
    if ('vibrate' in navigator) navigator.vibrate(20);
  }

  const canSave = found.some(ex => (setsMap[ex.id] ?? []).some(s => s.reps > 0));
  const totalVolume = found.reduce((acc, ex) =>
    acc + (setsMap[ex.id] ?? []).reduce((a, s) => a + s.reps * s.kg, 0), 0);

  function handleSave() {
    if (!canSave) return;
    persistAll();
    if ('vibrate' in navigator) navigator.vibrate(50);
    show('Superset salvato ✓', 'ok');
    setTimeout(() => navigate('/'), 700);
  }

  const isMeters = (ex: Exercise) => ex.metric === 'meters';

  return (
    <>
      <div className="px-4 pt-4 pb-5 space-y-5 max-w-lg mx-auto w-full">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[var(--sl-text-dim)] active:text-slate-200 py-2 pr-4 min-h-[48px] -ml-1"
        >
          <ArrowLeft size={20} strokeWidth={2} />
          <span className="sl-label text-[10px]">Sessione</span>
        </button>

        {/* Header */}
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 sl-label text-[10px] text-[var(--sl-violet-soft)]">
            <Link2 size={13} /> Superset · serie alternate
          </span>
          {found.map(ex => (
            <h1 key={ex.id} className="text-xl font-bold leading-snug text-white" style={{ fontFamily: 'var(--font-ui)' }}>
              {ex.name}
              {ex.unilateral && <span className="text-slate-400 font-normal text-base ml-2">(per lato)</span>}
            </h1>
          ))}
          <p className="text-[var(--sl-text-dim)] text-xs">
            Completa una serie per esercizio, poi recupera. Carico pre-compilato dall'ultima volta.
          </p>
        </div>

        {/* Giri */}
        {Array.from({ length: rounds }).map((_, r) => (
          <div key={r} className="sl-panel rounded-2xl px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="sl-label text-[11px] text-[var(--sl-violet-soft)]">Giro {r + 1}</span>
              <button
                type="button"
                onClick={startRest}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg shrink-0 text-[var(--sl-cyan-soft)] text-xs font-semibold border border-[var(--sl-line)] bg-[rgba(56,225,255,0.06)] active:bg-[rgba(56,225,255,0.16)]"
              >
                <Timer size={14} strokeWidth={2.25} />
                Riposo {formatClock(restSeconds)}
              </button>
            </div>

            {meta.map(({ ex, last }) => {
              const sets = setsMap[ex.id] ?? [];
              if (r >= sets.length) return null;
              const s = sets[r];
              const lastSet = last?.sets[r];
              const vol = parseFloat((s.reps * s.kg).toFixed(1));
              return (
                <div key={ex.id} className="space-y-2 border-t border-[var(--sl-line-soft)] pt-2.5 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-200 truncate">{ex.name}</p>
                    {vol > 0 && <span className="text-[11px] text-[var(--sl-text-dim)] tabular-nums shrink-0">{vol} kg</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 text-[10px] uppercase tracking-wide text-slate-500">{isMeters(ex) ? 'metri' : 'reps'}</span>
                      <MiniStepper value={s.reps} step={1} min={0} onChange={v => updateSet(ex.id, r, 'reps', v)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-[10px] uppercase tracking-wide text-slate-500">kg</span>
                      <MiniStepper value={s.kg} step={2.5} min={0} onChange={v => updateSet(ex.id, r, 'kg', v)} />
                    </div>
                  </div>
                  {lastSet && (lastSet.reps > 0 || lastSet.kg > 0) && (
                    <span className="text-[11px] text-[var(--sl-text-dim)] tabular-nums">
                      ↩ ultima: <span className="text-slate-400">{lastSet.reps} × {lastSet.kg}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Volume + Salva */}
        {totalVolume > 0 && (
          <div className="sl-panel rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="sl-label text-[10px] text-[var(--sl-text-dim)]">Volume superset</span>
            <span className="text-xl font-bold text-white tabular-nums sl-display">
              {totalVolume.toFixed(1)}<span className="text-sm font-normal text-[var(--sl-text-dim)] ml-1">kg</span>
            </span>
          </div>
        )}

        <div className="sticky bottom-3 z-10 pt-4 -mb-1 bg-gradient-to-t from-[var(--sl-bg)] via-[var(--sl-bg)]/85 to-transparent">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="sl-btn w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base min-h-[56px]"
          >
            <Check size={20} strokeWidth={2.5} />
            {canSave ? 'Salva superset' : 'Inserisci almeno 1 serie'}
          </button>
        </div>
      </div>

      <ToastStack toasts={toasts} />
    </>
  );
}
