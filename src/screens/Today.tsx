// src/screens/Today.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate }       from 'react-router-dom';
import {
  MapPin, Moon, Footprints,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { TOTAL_WEEKS, type Exercise, type Muscle } from '../data/program';
import { useLogStore }        from '../hooks/useLogStore';
import { useCurrentSession }  from '../hooks/useCurrentSession';
import { useProgramData }     from '../hooks/useProgramData';
import { useSwaps }           from '../hooks/useSwaps';
import { useSupersets }       from '../hooks/useSupersets';
import { ExerciseCard }       from '../components/ExerciseCard';
import { SwapPicker }         from '../components/SwapPicker';
import { SupersetPicker }     from '../components/SupersetPicker';
import { SupersetCard }       from '../components/SupersetCard';
import { sessionCode }        from '../lib/sessionLabel';
import { switchSchedule }     from '../lib/schedules';
import { formatDisplay }      from '../lib/dates';

interface SwapTarget {
  originalId:     string;
  effective:      Exercise;
  priorityMuscle: Muscle;
  isSwapped:      boolean;
}

// Selezione (settimana + sessione) persistita per la sessione del browser:
// tornando da un esercizio si resta sulla sessione che si stava guardando,
// mentre a un nuovo avvio dell'app si riparte dalla sessione del giorno.
const SELECTION_KEY = 'today-selection-v1';

function readSelection(): { week: number; sessionId: string } | null {
  try {
    const raw = sessionStorage.getItem(SELECTION_KEY);
    if (raw) return JSON.parse(raw) as { week: number; sessionId: string };
  } catch { /* ignore */ }
  return null;
}

export function Today() {
  const { startDate, getExerciseLog, clearExerciseLog } = useLogStore();
  const program = useProgramData();
  const { weekNumber: defaultWeek, dayKey: defaultDay, dateISO } = useCurrentSession(startDate);

  // Sessione di default = quella del giorno di calendario, altrimenti la prima
  const defaultSessionId =
    program.baseSessions.find(s => s.day === defaultDay)?.id
    ?? program.baseSessions[0]?.id
    ?? '';

  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    const saved = readSelection()?.week;
    return saved && saved >= 1 && saved <= TOTAL_WEEKS ? saved : defaultWeek;
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    const saved = readSelection()?.sessionId;
    return saved && program.baseSessions.some(s => s.id === saved) ? saved : defaultSessionId;
  });

  // Persisti la selezione per la sessione del browser
  useEffect(() => {
    try {
      sessionStorage.setItem(SELECTION_KEY, JSON.stringify({ week: selectedWeek, sessionId: selectedSessionId }));
    } catch { /* ignore */ }
  }, [selectedWeek, selectedSessionId]);

  const navigate = useNavigate();
  const { getSwap, setSwap, clearSwap } = useSwaps();
  const { partnerOf, setPair, removePairOf } = useSupersets();
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [supersetTarget, setSupersetTarget] = useState<Exercise | null>(null);

  // Tutti gli esercizi unici del programma (candidati per la sostituzione)
  const allExercises = useMemo(() => {
    const seen = new Set<string>();
    const list: Exercise[] = [];
    for (const s of program.baseSessions) {
      for (const ex of s.exercises) {
        if (!seen.has(ex.id)) { seen.add(ex.id); list.push(ex); }
      }
    }
    return list;
  }, [program]);

  const sessionTabs = program.baseSessions.map(s => ({
    sessionId: s.id,
    code:      sessionCode(s),
    isToday:   s.day === defaultDay,
  }));

  const week    = program.getWeek(selectedWeek)!;
  const session = week?.sessions.find(s => s.id === selectedSessionId);

  // Applica le sostituzioni: ogni slot può puntare a un esercizio alternativo
  const effectiveExercises = session
    ? session.exercises.map(original => {
        const subId = getSwap(selectedWeek, session.id, original.id);
        const effective = subId
          ? (program.findExercise(selectedWeek, subId)?.exercise ?? original)
          : original;
        return { original, effective, isSwapped: !!subId && effective.id !== original.id };
      })
    : [];

  const totalExercises = effectiveExercises.length;
  const completedCount = effectiveExercises.filter(({ effective }) => {
    const log = getExerciseLog(selectedWeek, session!.id, dateISO, effective.id);
    return (log?.sets.length ?? 0) >= effective.prescribedSets;
  }).length;
  const pct           = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;
  const isSessionDone = totalExercises > 0 && completedCount === totalExercises;

  // Raggruppa gli esercizi abbinati in superset (coppie) per il rendering
  type EffItem = (typeof effectiveExercises)[number];
  type RenderItem = { kind: 'single'; item: EffItem } | { kind: 'pair'; a: EffItem; b: EffItem };
  const renderItems: RenderItem[] = [];
  {
    const seen = new Set<string>();
    for (const item of effectiveExercises) {
      if (seen.has(item.effective.id)) continue;
      const partnerId = session ? partnerOf(selectedWeek, session.id, item.effective.id) : null;
      const partner = partnerId ? effectiveExercises.find(x => x.effective.id === partnerId) : undefined;
      if (partner && !seen.has(partner.effective.id)) {
        seen.add(item.effective.id);
        seen.add(partner.effective.id);
        renderItems.push({ kind: 'pair', a: item, b: partner });
      } else {
        seen.add(item.effective.id);
        renderItems.push({ kind: 'single', item });
      }
    }
  }

  return (
    <div className="px-4 pt-5 pb-10 max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div>
        <p className="sl-label text-[10px] text-[var(--sl-cyan)] sl-glow-text">▣ Missione Giornaliera</p>
        <h1 className="sl-heading text-2xl mt-1">{formatDisplay(dateISO)}</h1>
      </div>

      {/* Selettore scheda (solo se ci sono schede custom) */}
      {program.schedules.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Scheda</p>
          <div className="flex gap-1.5 flex-wrap">
            {[{ id: 'default', name: 'Predefinita' }, ...program.schedules.map(s => ({ id: s.id, name: s.name }))].map(sch => {
              const isActive = sch.id === program.activeScheduleId;
              return (
                <button
                  key={sch.id}
                  onClick={() => { if (!isActive) switchSchedule(sch.id); }}
                  className={[
                    'px-3 py-2 rounded-xl border text-xs font-bold min-h-[44px] transition-colors',
                    isActive
                      ? 'bg-[var(--sl-violet)] border-[var(--sl-violet-soft)] text-white shadow-[0_0_12px_var(--sl-glow-violet)]'
                      : 'bg-[rgba(56,225,255,0.05)] border-[var(--sl-line-soft)] text-[var(--sl-text-dim)] active:bg-[rgba(56,225,255,0.12)]',
                  ].join(' ')}
                >
                  {sch.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Picker settimana */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Settimana</p>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(wk => {
            const isActive  = wk === selectedWeek;
            const isDeload  = wk === TOTAL_WEEKS;
            const isCurrent = wk === defaultWeek;
            return (
              <button
                key={wk}
                onClick={() => setSelectedWeek(wk)}
                className={[
                  'flex-1 flex flex-col items-center justify-center py-2 rounded-xl border',
                  'text-xs font-bold min-h-[48px] transition-colors relative',
                  isActive
                    ? isDeload ? 'bg-amber-600 border-amber-500 text-white'
                               : 'bg-[var(--sl-cyan)] border-[var(--sl-cyan-soft)] text-[#06121e] shadow-[0_0_12px_var(--sl-glow)]'
                    : 'bg-[rgba(56,225,255,0.05)] border-[var(--sl-line-soft)] text-[var(--sl-text-dim)] active:bg-[rgba(56,225,255,0.12)]',
                ].join(' ')}
              >
                <span>S{wk}</span>
                {isDeload && (
                  <span className={`text-[9px] font-normal ${isActive ? 'text-amber-200' : 'text-amber-600'}`}>
                    deload
                  </span>
                )}
                {isCurrent && !isActive && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--sl-cyan)]" />
                )}
              </button>
            );
          })}
        </div>
        {selectedWeek !== defaultWeek && (
          <p className="text-[11px] text-slate-500 pl-0.5">
            Settimana corrente calcolata: <span className="text-indigo-400">S{defaultWeek}</span>
            {' — '}
            <button onClick={() => setSelectedWeek(defaultWeek)} className="text-indigo-400 underline">
              ripristina
            </button>
          </p>
        )}
      </div>

      {/* Picker sessione */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Sessione</p>
        <div className="flex gap-1.5 flex-wrap">
          {sessionTabs.map(tab => {
            const isActive = tab.sessionId === selectedSessionId;
            return (
              <button
                key={tab.sessionId}
                onClick={() => setSelectedSessionId(tab.sessionId)}
                className={[
                  'flex-1 flex flex-col items-center justify-center py-2 rounded-xl border',
                  'text-sm font-bold min-h-[48px] transition-colors relative',
                  isActive
                    ? 'bg-[rgba(56,225,255,0.16)] border-[var(--sl-cyan)] text-[var(--sl-cyan-soft)]'
                    : 'bg-[rgba(56,225,255,0.05)] border-[var(--sl-line-soft)] text-[var(--sl-text-dim)] active:bg-[rgba(56,225,255,0.12)]',
                ].join(' ')}
              >
                <span>{tab.code}</span>
                {tab.isToday && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isActive ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner Deload */}
      {week?.isDeload && (
        <div className="rounded-2xl bg-amber-950/60 border border-amber-700/70 px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="text-amber-300 font-bold text-sm uppercase tracking-wide">Deload — Settimana di scarico</p>
            <p className="text-amber-200/70 text-xs mt-0.5">−1 serie per esercizio · carico −10% · RPE 5-6</p>
          </div>
        </div>
      )}

      {/* Nessuna sessione */}
      {!session && (
        <div className="sl-panel rounded-3xl px-5 py-8 flex flex-col items-center text-center gap-4">
          <Moon size={48} className="text-slate-600" strokeWidth={1.25} />
          <div>
            <h2 className="text-lg font-bold">Nessuna sessione</h2>
            <p className="text-slate-400 text-sm mt-1">Nessuna sessione selezionata nel programma.</p>
          </div>
          <div className="w-full rounded-2xl bg-[rgba(56,225,255,0.06)] border border-[var(--sl-line-soft)] px-4 py-3 flex items-center gap-3">
            <Footprints size={20} className="text-amber-400 shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-slate-300 text-left">
              <span className="font-semibold text-amber-300">NEAT:</span> 8.000–10.000 passi consigliati.
            </p>
          </div>
        </div>
      )}

      {/* Sessione attiva */}
      {session && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-lg
              text-sm font-black sl-display text-[#06121e] bg-[var(--sl-cyan)] shadow-[0_0_10px_var(--sl-glow)]">
              {sessionCode(session)}
            </span>
            <span className="text-slate-200 font-semibold">{session.focus}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} strokeWidth={2} />
              {session.location === 'palestra' ? 'Palestra' : 'Casa'}
            </span>
          </div>

          {/* Barra progresso */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{completedCount} / {totalExercises} esercizi completati</span>
              <span className="font-semibold text-slate-400">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(6,10,20,0.7)] border border-[var(--sl-line-soft)] overflow-hidden">
              <div
                className={['h-full rounded-full transition-all duration-500', isSessionDone ? 'bg-emerald-500' : 'bg-[var(--sl-cyan)] shadow-[0_0_10px_var(--sl-glow)]'].join(' ')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Lista esercizi */}
          <div className="space-y-2.5">
            {renderItems.map(ri => ri.kind === 'pair' ? (
              <SupersetCard
                key={`ss-${ri.a.effective.id}`}
                a={ri.a.effective}
                b={ri.b.effective}
                logA={getExerciseLog(selectedWeek, session.id, dateISO, ri.a.effective.id)}
                logB={getExerciseLog(selectedWeek, session.id, dateISO, ri.b.effective.id)}
                onClick={() => navigate(`/superset/${selectedWeek}/${session.id}/${ri.a.effective.id},${ri.b.effective.id}`)}
                onUnpair={() => removePairOf(selectedWeek, session.id, ri.a.effective.id)}
              />
            ) : (
              <ExerciseCard
                key={ri.item.original.id}
                exercise={ri.item.effective}
                log={getExerciseLog(selectedWeek, session.id, dateISO, ri.item.effective.id)}
                isSwapped={ri.item.isSwapped}
                onClick={() => navigate(`/esercizio/${selectedWeek}/${session.id}/${ri.item.effective.id}`)}
                onReset={() => clearExerciseLog(selectedWeek, session.id, dateISO, ri.item.effective.id)}
                onSwap={() => setSwapTarget({ originalId: ri.item.original.id, effective: ri.item.effective, priorityMuscle: ri.item.original.muscle, isSwapped: ri.item.isSwapped })}
                onSuperset={() => setSupersetTarget(ri.item.effective)}
              />
            ))}
          </div>

          {/* Banner completamento */}
          {isSessionDone && (
            <div className="rounded-2xl bg-emerald-950/60 border border-emerald-700/60 px-4 py-4 flex items-center gap-3">
              <CheckCircle2 size={26} className="text-emerald-400 shrink-0" strokeWidth={2} />
              <div>
                <p className="font-bold text-emerald-300">Sessione completata! 💪</p>
                <p className="text-emerald-500 text-sm mt-0.5">Recupera, mangia bene, dormi.</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selettore sostituzione esercizio */}
      {swapTarget && session && (
        <SwapPicker
          current={swapTarget.effective}
          priorityMuscle={swapTarget.priorityMuscle}
          candidates={allExercises}
          isSwapped={swapTarget.isSwapped}
          onPick={id => { setSwap(selectedWeek, session.id, swapTarget.originalId, id); setSwapTarget(null); }}
          onRevert={() => { clearSwap(selectedWeek, session.id, swapTarget.originalId); setSwapTarget(null); }}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* Selettore abbinamento superset */}
      {supersetTarget && session && (
        <SupersetPicker
          current={supersetTarget}
          candidates={effectiveExercises.filter(x => x.effective.id !== supersetTarget.id).map(x => x.effective)}
          partnerId={partnerOf(selectedWeek, session.id, supersetTarget.id)}
          onPick={id => { setPair(selectedWeek, session.id, supersetTarget.id, id); setSupersetTarget(null); }}
          onRemove={() => { removePairOf(selectedWeek, session.id, supersetTarget.id); setSupersetTarget(null); }}
          onClose={() => setSupersetTarget(null)}
        />
      )}
    </div>
  );
}
