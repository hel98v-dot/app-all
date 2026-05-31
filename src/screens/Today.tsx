// src/screens/Today.tsx
import { useState }          from 'react';
import { useNavigate }       from 'react-router-dom';
import {
  MapPin, Moon, Footprints,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { TOTAL_WEEKS, type DayKey } from '../data/program';
import { useLogStore }        from '../hooks/useLogStore';
import { useCurrentSession }  from '../hooks/useCurrentSession';
import { useProgramData }     from '../hooks/useProgramData';
import { ExerciseCard }       from '../components/ExerciseCard';
import { formatDisplay }      from '../lib/dates';

export function Today() {
  const { startDate, getExerciseLog, clearExerciseLog } = useLogStore();
  const program = useProgramData();
  const { weekNumber: defaultWeek, dayKey: defaultDay, dateISO } = useCurrentSession(startDate);

  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeek);
  const [selectedDay,  setSelectedDay]  = useState<DayKey>(() => {
    const hasSession = program.baseSessions.some(s => s.day === defaultDay);
    return hasSession ? defaultDay : (program.baseSessions[0]?.day ?? 'lunedi');
  });

  const navigate = useNavigate();

  const sessionTabs = program.baseSessions.map(s => ({
    dayKey:    s.day,
    sessionId: s.id,
    short:     s.dayLabel.slice(0, 3),
    isToday:   s.day === defaultDay,
  }));

  const week    = program.getWeek(selectedWeek)!;
  const session = program.getSession(selectedWeek, selectedDay);

  const totalExercises = session?.exercises.length ?? 0;
  const completedCount = session?.exercises.filter(ex => {
    const log = getExerciseLog(selectedWeek, session!.id, dateISO, ex.id);
    return (log?.sets.length ?? 0) >= ex.prescribedSets;
  }).length ?? 0;
  const pct           = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;
  const isSessionDone = totalExercises > 0 && completedCount === totalExercises;

  return (
    <div className="px-4 pt-5 pb-10 max-w-lg mx-auto space-y-4">

      {/* Header */}
      <div>
        <p className="sl-label text-[10px] text-[var(--sl-cyan)] sl-glow-text">▣ Missione Giornaliera</p>
        <h1 className="sl-heading text-2xl mt-1">{formatDisplay(dateISO)}</h1>
      </div>

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
                               : 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 active:bg-slate-700',
                ].join(' ')}
              >
                <span>S{wk}</span>
                {isDeload && (
                  <span className={`text-[9px] font-normal ${isActive ? 'text-amber-200' : 'text-amber-600'}`}>
                    deload
                  </span>
                )}
                {isCurrent && !isActive && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
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
            const isActive = tab.dayKey === selectedDay;
            return (
              <button
                key={tab.dayKey}
                onClick={() => setSelectedDay(tab.dayKey)}
                className={[
                  'flex-1 flex flex-col items-center justify-center py-2 rounded-xl border',
                  'text-xs font-bold min-h-[48px] transition-colors relative',
                  isActive
                    ? 'bg-slate-600 border-slate-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 active:bg-slate-700',
                ].join(' ')}
              >
                <span>{tab.short}</span>
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
        <div className="rounded-3xl bg-slate-800 border border-slate-700 px-5 py-8 flex flex-col items-center text-center gap-4">
          <Moon size={48} className="text-slate-600" strokeWidth={1.25} />
          <div>
            <h2 className="text-lg font-bold">Nessuna sessione</h2>
            <p className="text-slate-400 text-sm mt-1">Questo giorno non ha una sessione nel programma.</p>
          </div>
          <div className="w-full rounded-2xl bg-slate-700/60 border border-slate-600/50 px-4 py-3 flex items-center gap-3">
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
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={['h-full rounded-full transition-all duration-500', isSessionDone ? 'bg-emerald-500' : 'bg-indigo-500'].join(' ')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Lista esercizi */}
          <div className="space-y-2.5">
            {session.exercises.map(exercise => {
              const log = getExerciseLog(selectedWeek, session.id, dateISO, exercise.id);
              return (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  log={log}
                  onClick={() => navigate(`/esercizio/${selectedWeek}/${session.id}/${exercise.id}`)}
                  onReset={() => clearExerciseLog(selectedWeek, session.id, dateISO, exercise.id)}
                />
              );
            })}
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
    </div>
  );
}
