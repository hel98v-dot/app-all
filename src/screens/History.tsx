// src/screens/History.tsx
// Storico sessioni raggruppate per settimana — accordion a due livelli.

import { useState } from 'react';
import { ChevronDown, ChevronRight, Dumbbell, Calendar } from 'lucide-react';
import { useLogStore }     from '../hooks/useLogStore';
import { useProgramData }  from '../hooks/useProgramData';
import { formatDisplay, today, parseDate, addDays } from '../lib/dates';
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
    <div className="flex items-start justify-between py-2 border-b border-[var(--sl-line-soft)] last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm text-slate-200 font-medium leading-snug">{name}</p>
        <p className="text-xs text-[var(--sl-text-dim)] mt-0.5">
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
          <p className="text-xs text-[var(--sl-cyan-soft)]/80 italic mt-0.5">"{log.notes}"</p>
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
    <div className="sl-panel rounded-xl overflow-hidden">
      {/* Intestazione sessione */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent active:bg-[rgba(56,225,255,0.06)] transition-colors text-left"
      >
        <Calendar size={16} className="text-[var(--sl-cyan)] shrink-0" strokeWidth={2} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 leading-snug">
            {formatDisplay(session.date)}
          </p>
          <p className="text-xs text-[var(--sl-text-dim)] truncate mt-0.5">{focus}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {vol > 0 && (
            <span className="text-xs font-semibold tabular-nums text-slate-300">
              {vol.toLocaleString('it-IT')} kg
            </span>
          )}
          {open
            ? <ChevronDown size={16} className="text-[var(--sl-text-dim)]" />
            : <ChevronRight size={16} className="text-[var(--sl-text-dim)]" />
          }
        </div>
      </button>

      {/* Lista esercizi espansa */}
      {open && (
        <div className="bg-[rgba(6,10,20,0.5)] border-t border-[var(--sl-line-soft)] px-4 py-2">
          {session.exercises.length === 0 ? (
            <p className="text-xs text-[var(--sl-text-dim)] py-2 italic">Nessun esercizio loggato.</p>
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
          'bg-[rgba(56,225,255,0.1)] border border-[var(--sl-line)]',
          'text-[var(--sl-cyan-soft)] text-xs font-bold',
        ].join(' ')}>
          {group.weekNumber}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-100">
            Settimana {group.weekNumber}
          </p>
          <p className="text-xs text-[var(--sl-text-dim)]">
            {group.sessions.length} session{group.sessions.length !== 1 ? 'i' : 'e'}
            {group.totalVolume > 0 && (
              <>
                {' · '}
                <span className="text-[var(--sl-text-dim)] font-medium tabular-nums">
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
            'text-[var(--sl-text-dim)] transition-transform duration-200 shrink-0',
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
      <div className="sl-divider mt-1" />
    </section>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────

// ── Griglia 4 settimane (calendario sessioni) ─────────────────────────────────

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function FourWeekGrid({ logs }: { logs: SessionLog[] }) {
  const t = today();

  // Date con almeno una sessione svolta (volume > 0)
  const doneDates = new Set<string>();
  for (const log of logs) {
    if (sessionVolume(log) > 0) doneDates.add(log.date);
  }

  // Lunedì della settimana corrente, poi indietro di 3 settimane → 28 giorni
  const dow    = (parseDate(t).getDay() + 6) % 7;   // 0 = lunedì
  const curMon = addDays(t, -dow);
  const start  = addDays(curMon, -21);
  const days   = Array.from({ length: 28 }, (_, i) => addDays(start, i));

  return (
    <section className="sl-panel rounded-2xl px-4 py-4 space-y-3 mb-5">
      <p className="sl-label text-[10px] text-[var(--sl-text-dim)]">Ultime 4 settimane</p>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center sl-label text-[9px] text-[var(--sl-text-dim)] pb-0.5">{d}</div>
        ))}
        {days.map(d => {
          const done    = doneDates.has(d);
          const isToday = d === t;
          const future  = d > t;
          const dayNum  = parseDate(d).getDate();
          return (
            <div
              key={d}
              className={[
                'aspect-square rounded-lg flex items-center justify-center text-[13px] tabular-nums',
                done
                  ? 'bg-emerald-500/90 text-white font-bold border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                  : 'bg-[rgba(56,225,255,0.04)] border border-[var(--sl-line-soft)] text-[var(--sl-text-dim)]',
                isToday ? 'ring-2 ring-[var(--sl-cyan)]' : '',
                future  ? 'opacity-35' : '',
              ].join(' ')}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <span className="w-3 h-3 rounded bg-emerald-500/90 border border-emerald-400/50" />
        <span className="text-[11px] text-[var(--sl-text-dim)]">Sessione svolta</span>
      </div>
    </section>
  );
}

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
        <p className="text-[var(--sl-text-dim)] text-sm max-w-xs">
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
        <p className="text-[var(--sl-text-dim)] text-sm mt-0.5">
          {totalSessions} session{totalSessions !== 1 ? 'i' : 'e'}
          {grandTotal > 0 && (
            <> · <span className="text-[var(--sl-text-dim)] font-medium tabular-nums">
              {grandTotal.toLocaleString('it-IT')} kg
            </span> volume totale</>
          )}
        </p>
      </div>

      {/* Calendario ultime 4 settimane */}
      <FourWeekGrid logs={logs} />

      {/* Gruppi settimana */}
      {groups.map(g => (
        <WeekSection key={g.weekNumber} group={g} findEx={program.findExercise} />
      ))}
    </div>
  );
}
