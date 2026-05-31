// src/screens/History.tsx
// Storico sessioni raggruppate per settimana — accordion a due livelli.

import { useState } from 'react';
import { ChevronDown, ChevronRight, Dumbbell, Calendar } from 'lucide-react';
import { useLogStore }     from '../hooks/useLogStore';
import { useProgramData }  from '../hooks/useProgramData';
import { formatDisplay }   from '../lib/dates';
import type { ExerciseLog, SessionLog } from '../types';

// ── Calcoli volume ────────────────────────────────────────────────────────────

function exerciseVolume(log: ExerciseLog): number {
  return log.sets.reduce((acc, s) => acc + s.reps * s.kg, 0);
}

function sessionVolume(session: SessionLog): number {
  return session.exercises.reduce((acc, ex) => acc + exerciseVolume(ex), 0);
}

// ── Raggruppamento ────────────────────────────────────────────────────────────

interface WeekGroup {
  weekNumber: number;
  sessions:   SessionLog[];
  totalVolume: number;
}

function groupByWeek(logs: SessionLog[]): WeekGroup[] {
  const map = new Map<number, SessionLog[]>();
  for (const log of logs) {
    const arr = map.get(log.weekNumber) ?? [];
    arr.push(log);
    map.set(log.weekNumber, arr);
  }

  return Array.from(map.entries())
    .map(([weekNumber, sessions]) => ({
      weekNumber,
      // Sessioni ordinate per data discendente dentro la settimana
      sessions: [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
      totalVolume: sessions.reduce((acc, s) => acc + sessionVolume(s), 0),
    }))
    // Settimane più recenti prima
    .sort((a, b) => b.weekNumber - a.weekNumber);
}

// Tipo della findExercise passata come prop
type FindEx = (wk: number, id: string) => { session: { focus: string }; exercise: { name: string } } | undefined;

// ── Componente esercizio dentro una sessione ──────────────────────────────────

function ExerciseRow({ log, weekNumber, findEx }: { log: ExerciseLog; weekNumber: number; findEx: FindEx }) {
  const found = findEx(weekNumber, log.exerciseId);
  const name  = found?.exercise.name ?? log.exerciseId;
  const vol   = exerciseVolume(log);

  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-700/50 last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm text-slate-200 font-medium leading-snug">{name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {log.sets.length} set
          {log.sets.length > 0 && (
            <>
              {' · '}
              {log.sets.map((s, i) => (
                <span key={i} className="tabular-nums">
                  {i > 0 && ', '}
                  {s.reps}×{s.kg}kg
                </span>
              ))}
            </>
          )}
        </p>
        {log.notes && (
          <p className="text-xs text-indigo-300/70 italic mt-0.5">"{log.notes}"</p>
        )}
      </div>
      {vol > 0 && (
        <span className="text-sm font-semibold tabular-nums text-slate-300 shrink-0">
          {vol.toLocaleString('it-IT')} kg
        </span>
      )}
    </div>
  );
}

// ── Componente riga sessione (espandibile) ────────────────────────────────────

function SessionRow({ session, findEx }: { session: SessionLog; findEx: FindEx }) {
  const [open, setOpen] = useState(false);
  const vol = sessionVolume(session);

  const found = session.exercises[0]
    ? findEx(session.weekNumber, session.exercises[0].exerciseId)
    : undefined;
  const focus = found?.session.focus ?? session.sessionId.toUpperCase();

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60">
      {/* Intestazione sessione */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 active:bg-slate-700 transition-colors text-left"
      >
        <Calendar size={16} className="text-indigo-400 shrink-0" strokeWidth={2} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 leading-snug">
            {formatDisplay(session.date)}
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{focus}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {vol > 0 && (
            <span className="text-xs font-semibold tabular-nums text-slate-300">
              {vol.toLocaleString('it-IT')} kg
            </span>
          )}
          {open
            ? <ChevronDown size={16} className="text-slate-500" />
            : <ChevronRight size={16} className="text-slate-500" />
          }
        </div>
      </button>

      {/* Lista esercizi espansa */}
      {open && (
        <div className="bg-slate-900 px-4 py-2">
          {session.exercises.length === 0 ? (
            <p className="text-xs text-slate-600 py-2 italic">Nessun esercizio loggato.</p>
          ) : (
            session.exercises.map(ex => (
              <ExerciseRow key={ex.exerciseId} log={ex} weekNumber={session.weekNumber} findEx={findEx} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente gruppo settimana (espandibile) ─────────────────────────────────

function WeekSection({ group, findEx }: { group: WeekGroup; findEx: FindEx }) {
  const [open, setOpen] = useState(true); // ultima settimana aperta di default

  return (
    <section>
      {/* Header settimana */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-1 py-3 text-left group"
      >
        <div className={[
          'flex items-center justify-center w-7 h-7 rounded-lg shrink-0',
          'bg-indigo-900/60 border border-indigo-700/50',
          'text-indigo-300 text-xs font-bold',
        ].join(' ')}>
          {group.weekNumber}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-100">
            Settimana {group.weekNumber}
          </p>
          <p className="text-xs text-slate-500">
            {group.sessions.length} session{group.sessions.length !== 1 ? 'i' : 'e'}
            {group.totalVolume > 0 && (
              <>
                {' · '}
                <span className="text-slate-400 font-medium tabular-nums">
                  {group.totalVolume.toLocaleString('it-IT')} kg
                </span>
                {' totali'}
              </>
            )}
          </p>
        </div>

        <ChevronDown
          size={18}
          className={[
            'text-slate-500 transition-transform duration-200 shrink-0',
            open ? 'rotate-0' : '-rotate-90',
          ].join(' ')}
        />
      </button>

      {/* Sessioni della settimana */}
      {open && (
        <div className="space-y-2 pb-2">
          {group.sessions.map(s => (
            <SessionRow key={s.id} session={s} findEx={findEx} />
          ))}
        </div>
      )}

      {/* Divisore */}
      <div className="border-b border-slate-800 mt-1" />
    </section>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────

export function History() {
  const { getAllSessionLogs } = useLogStore();
  const program = useProgramData();
  const logs    = getAllSessionLogs();
  const groups  = groupByWeek(logs);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6 text-center">
        <Dumbbell size={52} className="text-slate-700" strokeWidth={1.25} />
        <h1 className="sl-heading text-2xl">Registro</h1>
        <p className="text-slate-500 text-sm max-w-xs">
          Nessuna sessione ancora. Allena­ti e i tuoi log appariranno qui.
        </p>
      </div>
    );
  }

  const totalSessions = logs.length;
  const grandTotal    = logs.reduce((acc, s) => acc + sessionVolume(s), 0);

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-1">

      {/* Header pagina */}
      <div className="mb-4">
        <h1 className="sl-heading text-2xl">Registro</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {totalSessions} session{totalSessions !== 1 ? 'i' : 'e'}
          {grandTotal > 0 && (
            <> · <span className="text-slate-400 font-medium tabular-nums">
              {grandTotal.toLocaleString('it-IT')} kg
            </span> volume totale</>
          )}
        </p>
      </div>

      {/* Gruppi settimana */}
      {groups.map(g => (
        <WeekSection key={g.weekNumber} group={g} findEx={program.findExercise} />
      ))}
    </div>
  );
}
