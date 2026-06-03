// src/components/BodyweightCard.tsx
// Peso corporeo: card misura (input + andamento + storico) con in più la
// "forza relativa" (1RM stimato dei lift principali / peso corporeo).

import { Scale } from 'lucide-react';
import { MeasurementCard } from './MeasurementCard';
import { useLogStore }   from '../hooks/useLogStore';
import { useProgramData } from '../hooks/useProgramData';
import { exerciseHistory, recordsFromHistory } from '../lib/records';
import { STRENGTH_PRIMARY_IDS } from '../data/character';

function round1(n: number): number { return Math.round(n * 10) / 10; }

export function BodyweightCard() {
  const { getAllSessionLogs } = useLogStore();
  const program = useProgramData();

  const nameById = new Map<string, string>();
  for (const s of program.baseSessions) for (const e of s.exercises) nameById.set(e.id, e.name);
  const allSessions = getAllSessionLogs();

  return (
    <MeasurementCard
      storageName="bodyweight"
      title="Peso corporeo"
      unit="kg"
      step={0.5}
      min={30}
      defaultValue={70}
      icon={<Scale size={14} className="text-[var(--sl-cyan)]" />}
      renderExtra={latest => {
        if (!latest) return null;
        const relList = STRENGTH_PRIMARY_IDS
          .filter(id => nameById.has(id))
          .map(id => {
            const recs = recordsFromHistory(exerciseHistory(allSessions, id));
            return { id, name: nameById.get(id) ?? id, e1rm: recs.maxE1rm };
          })
          .filter(r => r.e1rm > 0)
          .map(r => ({ ...r, ratio: r.e1rm / latest.value }));

        if (relList.length === 0) return null;

        return (
          <div className="space-y-1.5 pt-1">
            <p className="sl-label text-[10px] text-[var(--sl-text-dim)]">Forza relativa (1RM stim. / peso)</p>
            {relList.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-300 truncate">{r.name}</span>
                <span className="tabular-nums shrink-0">
                  <span className="text-white font-bold">{round1(r.ratio)}×</span>
                  <span className="text-[var(--sl-text-dim)] text-xs"> peso</span>
                </span>
              </div>
            ))}
          </div>
        );
      }}
    />
  );
}
