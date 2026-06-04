// src/components/WeeklyQuests.tsx
// Pannello "Quest settimanali" — obiettivi della settimana corrente con
// barra di progresso e ricompensa XP. Si azzera al cambio settimana.

import { Check } from 'lucide-react';
import { useWeeklyQuests, type Quest } from '../hooks/useWeeklyQuests';

const SYS = '#38e1ff';

function QuestRow({ q }: { q: Quest }) {
  const pct = Math.min(100, q.target > 0 ? (q.current / q.target) * 100 : 0);

  return (
    <div
      className={[
        'rounded-2xl border px-4 py-3 transition-all',
        q.done
          ? 'bg-[rgba(16,40,32,0.5)] border-emerald-600/45 shadow-[0_0_12px_rgba(16,185,129,0.12)]'
          : 'sl-panel',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className={`text-2xl shrink-0 ${q.done ? '' : 'grayscale opacity-80'}`}>{q.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-bold ${q.done ? 'text-emerald-300' : 'text-slate-100'}`}>
              {q.title}
            </span>
            <span className="sl-label text-[9px] text-[var(--sl-text-dim)] shrink-0">+{q.xp} XP</span>
          </div>
          <p className="text-xs text-[var(--sl-text-dim)] mt-0.5">{q.desc}</p>

          {/* Barra progresso (nascosta per le quest booleane non completate) */}
          {!q.bool && (
            <div className="mt-2 h-1.5 rounded-full bg-[rgba(8,14,28,0.85)] overflow-hidden border border-[var(--sl-line-soft)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: q.done ? 'rgb(16,185,129)' : `linear-gradient(90deg, var(--sl-violet), ${SYS})`,
                }}
              />
            </div>
          )}
        </div>

        {q.done && (
          <span className="shrink-0 w-7 h-7 rounded-lg bg-emerald-500/90 flex items-center justify-center">
            <Check size={16} strokeWidth={3} className="text-[#06121e]" />
          </span>
        )}
      </div>
    </div>
  );
}

export function WeeklyQuests() {
  const { weekNumber, quests, completed, total } = useWeeklyQuests();

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <h2 className="sl-heading text-base flex items-center gap-2">
          <span>📜</span> Quest · Settimana {weekNumber}
        </h2>
        <span className="sl-label text-[10px] tabular-nums" style={{ color: completed === total ? 'rgb(52,211,153)' : SYS }}>
          {completed}/{total}
        </span>
      </div>

      <div className="space-y-2.5">
        {quests.map(q => <QuestRow key={q.id} q={q} />)}
      </div>
    </div>
  );
}
