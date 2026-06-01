// src/screens/Volume.tsx
// Tre tabelle: volume assoluto, WoW % e vs Settimana 1 %.

import { useState }            from 'react';
import { BarChart3, Info } from 'lucide-react';
import { type Muscle } from '../data/program';
import { useVolumeAggregate, pctChange, type VolumePerWeek, type VolumePerMuscleAndWeek } from '../hooks/useVolumeAggregate';
import { Sparkline }           from '../components/Sparkline';

// ── Configurazione ─────────────────────────────────────────────────────────────

const WEEKS      = [1, 2, 3, 4, 5] as const;
const WEEK_COLS  = WEEKS.map(n => `S${n}`);

// Ordine righe: Glutei e Addome in cima (priorità), poi gli altri
const MUSCLE_ORDER: Muscle[] = [
  'Glutei',
  'Addome',
  'Petto',
  'Dorso',
  'Spalle',
  'Quadricipiti',
  'Femorali',
  'Bicipiti',
  'Tricipiti',
];

// ── Helpers di formattazione ──────────────────────────────────────────────────

function fmtVol(n: number): string {
  if (n === 0) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtPct(ratio: number | null): string {
  if (ratio === null) return '—';
  const sign = ratio > 0 ? '+' : '';
  return `${sign}${Math.round(ratio * 100)}%`;
}

// Classi Tailwind per la cella Δ%
function deltaCell(ratio: number | null): string {
  if (ratio === null || ratio === 0) return 'bg-transparent text-[var(--sl-text-dim)]';
  return ratio > 0
    ? 'bg-emerald-900/50 text-emerald-300'
    : 'bg-rose-900/50   text-rose-300';
}

// ── Sottotitolo sezione ───────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2 pt-2">
      <h2 className="text-base font-bold text-slate-100">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--sl-text-dim)] mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Wrapper tabella scrollabile orizzontalmente ───────────────────────────────

function TableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[360px] text-sm border-collapse">
        {children}
      </table>
    </div>
  );
}

// Celle header colonna
function Th({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <th className={[
      'py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--sl-text-dim)]',
      'border-b border-[var(--sl-line)]',
      sticky
        ? 'sticky left-0 z-10 bg-[rgba(7,12,24,0.92)] text-left min-w-[90px]'
        : 'text-right',
    ].join(' ')}>
      {children}
    </th>
  );
}

// Cella muscolo (sticky)
function MuscleCell({ muscle }: { muscle: string }) {
  return (
    <td className="sticky left-0 z-10 bg-[rgba(7,12,24,0.92)] py-2.5 px-2 text-sm font-medium text-slate-200 whitespace-nowrap">
      {muscle}
    </td>
  );
}

// Cella valore volume
function VolumeCell({ value }: { value: number }) {
  return (
    <td className={[
      'py-2.5 px-2 text-right tabular-nums text-sm',
      value > 0 ? 'text-slate-200' : 'text-[var(--sl-text-dim)]',
    ].join(' ')}>
      {fmtVol(value)}
    </td>
  );
}

// Cella delta %
function DeltaCell({ ratio }: { ratio: number | null }) {
  return (
    <td className={[
      'py-2.5 px-2 text-right tabular-nums text-xs font-semibold rounded',
      deltaCell(ratio),
    ].join(' ')}>
      {fmtPct(ratio)}
    </td>
  );
}

// ── Tipo props condiviso ──────────────────────────────────────────────────────
interface TableProps {
  volumePerMuscleAndWeek: VolumePerMuscleAndWeek;
  volumePerWeek:          VolumePerWeek;
}

// ── Sezione 1: Volume Assoluto ────────────────────────────────────────────────

function AbsoluteTable({ volumePerMuscleAndWeek, volumePerWeek }: TableProps) {

  return (
    <>
      <SectionHeader
        title="Volume Assoluto"
        subtitle="kg totali per muscolo × settimana"
      />
      <TableScroll>
        <thead>
          <tr>
            <Th sticky>Muscolo</Th>
            {WEEK_COLS.map(w => <Th key={w}>{w}</Th>)}
          </tr>
        </thead>
        <tbody>
          {MUSCLE_ORDER.map(muscle => (
            <tr key={muscle} className="border-b border-[var(--sl-line-soft)]">
              <MuscleCell muscle={muscle} />
              {WEEKS.map(wk => (
                <VolumeCell key={wk} value={volumePerMuscleAndWeek[muscle][wk] ?? 0} />
              ))}
            </tr>
          ))}

          {/* Riga TOTALE */}
          <tr className="border-t border-[var(--sl-line)]">
            <td className="sticky left-0 z-10 bg-[rgba(56,225,255,0.06)] py-2.5 px-2 text-sm font-bold text-slate-100">
              Totale
            </td>
            {WEEKS.map(wk => (
              <td key={wk} className="py-2.5 px-2 text-right tabular-nums text-sm font-bold text-slate-100 bg-[rgba(56,225,255,0.06)]">
                {fmtVol(volumePerWeek[wk] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </TableScroll>
    </>
  );
}

// ── Sezione 2: WoW ────────────────────────────────────────────────────────────

const WOW_PAIRS = [
  [1, 2], [2, 3], [3, 4], [4, 5],
] as const;

function WoWTable({ volumePerMuscleAndWeek, volumePerWeek }: TableProps) {

  return (
    <>
      <SectionHeader
        title="WoW — Settimana su Settimana"
        subtitle="(settimana corrente − precedente) / precedente"
      />
      <TableScroll>
        <thead>
          <tr>
            <Th sticky>Muscolo</Th>
            {WOW_PAIRS.map(([a, b]) => <Th key={`${a}→${b}`}>S{a}→S{b}</Th>)}
          </tr>
        </thead>
        <tbody>
          {MUSCLE_ORDER.map(muscle => (
            <tr key={muscle} className="border-b border-[var(--sl-line-soft)]">
              <MuscleCell muscle={muscle} />
              {WOW_PAIRS.map(([a, b]) => {
                const ratio = pctChange(
                  volumePerMuscleAndWeek[muscle][a] ?? 0,
                  volumePerMuscleAndWeek[muscle][b] ?? 0,
                );
                return <DeltaCell key={`${a}→${b}`} ratio={ratio} />;
              })}
            </tr>
          ))}

          {/* Riga TOTALE */}
          <tr className="border-t border-[var(--sl-line)]">
            <td className="sticky left-0 z-10 bg-[rgba(56,225,255,0.06)] py-2.5 px-2 text-sm font-bold text-slate-100">
              Totale
            </td>
            {WOW_PAIRS.map(([a, b]) => {
              const ratio = pctChange(volumePerWeek[a] ?? 0, volumePerWeek[b] ?? 0);
              return (
                <td key={`${a}→${b}`} className={[
                  'py-2.5 px-2 text-right tabular-nums text-xs font-bold rounded bg-[rgba(56,225,255,0.06)]',
                  deltaCell(ratio),
                ].join(' ')}>
                  {fmtPct(ratio)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </TableScroll>
    </>
  );
}

// ── Sezione 3: vs Settimana 1 ─────────────────────────────────────────────────

const VS1_WEEKS = [2, 3, 4, 5] as const;

function VsWeek1Table({ volumePerMuscleAndWeek, volumePerWeek }: TableProps) {

  return (
    <>
      <SectionHeader
        title="vs Settimana 1"
        subtitle="Confronto con la settimana di riferimento"
      />
      <TableScroll>
        <thead>
          <tr>
            <Th sticky>Muscolo</Th>
            {VS1_WEEKS.map(w => <Th key={w}>S{w}</Th>)}
          </tr>
        </thead>
        <tbody>
          {MUSCLE_ORDER.map(muscle => (
            <tr key={muscle} className="border-b border-[var(--sl-line-soft)]">
              <MuscleCell muscle={muscle} />
              {VS1_WEEKS.map(wk => {
                const ratio = pctChange(
                  volumePerMuscleAndWeek[muscle][1] ?? 0,
                  volumePerMuscleAndWeek[muscle][wk] ?? 0,
                );
                return <DeltaCell key={wk} ratio={ratio} />;
              })}
            </tr>
          ))}

          {/* Riga TOTALE */}
          <tr className="border-t border-[var(--sl-line)]">
            <td className="sticky left-0 z-10 bg-[rgba(56,225,255,0.06)] py-2.5 px-2 text-sm font-bold text-slate-100">
              Totale
            </td>
            {VS1_WEEKS.map(wk => {
              const ratio = pctChange(volumePerWeek[1] ?? 0, volumePerWeek[wk] ?? 0);
              return (
                <td key={wk} className={[
                  'py-2.5 px-2 text-right tabular-nums text-xs font-bold rounded bg-[rgba(56,225,255,0.06)]',
                  deltaCell(ratio),
                ].join(' ')}>
                  {fmtPct(ratio)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </TableScroll>
    </>
  );
}

// ── Sezione 4: Andamento (sparkline) ──────────────────────────────────────────

function TrendSection({ volumePerMuscleAndWeek, volumePerWeek }: TableProps) {
  const lastWeek = ([5, 4, 3, 2, 1] as const).find(wk => (volumePerWeek[wk] ?? 0) > 0) ?? 1;
  const weeks = WEEKS.filter(wk => wk <= lastWeek);
  const totalPoints = weeks.map(wk => volumePerWeek[wk] ?? 0);
  const musclesWithData = MUSCLE_ORDER.filter(m =>
    weeks.some(wk => (volumePerMuscleAndWeek[m][wk] ?? 0) > 0));

  return (
    <>
      <SectionHeader title="Andamento" subtitle={`Volume settimanale (S1 → S${lastWeek})`} />

      {/* Totale */}
      <div className="rounded-xl border border-[var(--sl-line-soft)] bg-[rgba(56,225,255,0.05)] px-3 py-3 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="sl-label text-[10px] text-[var(--sl-text-dim)]">Totale · S{lastWeek}</span>
          <span className="text-base font-bold text-white tabular-nums">{fmtVol(volumePerWeek[lastWeek] ?? 0)}</span>
        </div>
        {totalPoints.length >= 2
          ? <Sparkline points={totalPoints} height={46} className="w-full" dot={false} />
          : <p className="text-xs text-[var(--sl-text-dim)]">Servono almeno 2 settimane di dati.</p>}
      </div>

      {/* Per muscolo */}
      <div className="grid grid-cols-2 gap-2">
        {musclesWithData.map(m => {
          const pts = weeks.map(wk => volumePerMuscleAndWeek[m][wk] ?? 0);
          return (
            <div key={m} className="rounded-xl border border-[var(--sl-line-soft)] bg-[rgba(56,225,255,0.03)] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-xs font-medium text-slate-300 truncate">{m}</span>
                <span className="text-[11px] font-bold text-slate-200 tabular-nums shrink-0">
                  {fmtVol(volumePerMuscleAndWeek[m][lastWeek] ?? 0)}
                </span>
              </div>
              {pts.length >= 2
                ? <Sparkline points={pts} height={26} className="w-full" dot={false} />
                : <div className="h-[26px]" />}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Navigazione sezioni ───────────────────────────────────────────────────────

type TabId = 'trend' | 'assoluto' | 'wow' | 'vs1';

const TABS: { id: TabId; label: string }[] = [
  { id: 'trend',    label: 'Trend'    },
  { id: 'assoluto', label: 'Assoluto' },
  { id: 'wow',      label: 'WoW %'    },
  { id: 'vs1',      label: 'vs Sett 1'},
];

// ── Schermata principale ──────────────────────────────────────────────────────

export function Volume() {
  const { volumePerWeek, volumePerMuscleAndWeek, isStale } = useVolumeAggregate();
  const [tab, setTab] = useState<TabId>('trend');
  const tableProps: TableProps = { volumePerMuscleAndWeek, volumePerWeek };

  const hasAnyData = Object.values(volumePerWeek).some(v => v > 0);

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6 text-center">
        <BarChart3 size={52} className="text-slate-700" strokeWidth={1.25} />
        <h1 className="sl-heading text-2xl">Volume</h1>
        <p className="text-[var(--sl-text-dim)] text-sm max-w-xs">
          Nessun dato ancora. Loga qualche sessione per vedere i grafici di volume.
        </p>
      </div>
    );
  }

  return (
    <div className={['px-4 pt-6 pb-10 max-w-lg mx-auto space-y-4', isStale ? 'opacity-60' : ''].join(' ')}>

      {/* Header */}
      <div>
        <h1 className="sl-heading text-2xl">Volume</h1>
        <p className="text-[var(--sl-text-dim)] text-sm mt-0.5 flex items-center gap-1">
          <Info size={12} />
          Volume = reps × kg per serie
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[rgba(56,225,255,0.06)] rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors sl-label text-[10px]',
              tab === t.id
                ? 'bg-[var(--sl-cyan)] text-[#06121e] shadow-[0_0_14px_var(--sl-glow)]'
                : 'text-[var(--sl-text-dim)] active:text-slate-200',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabella attiva */}
      <div className="sl-panel rounded-2xl overflow-hidden">
        <div className="p-3">
          {tab === 'trend'    && <TrendSection  {...tableProps} />}
          {tab === 'assoluto' && <AbsoluteTable {...tableProps} />}
          {tab === 'wow'      && <WoWTable      {...tableProps} />}
          {tab === 'vs1'      && <VsWeek1Table  {...tableProps} />}
        </div>
      </div>

      {/* Legenda */}
      {(tab === 'wow' || tab === 'vs1') && (
        <div className="flex items-center gap-4 px-1">
          <span className="flex items-center gap-1.5 text-xs text-[var(--sl-text-dim)]">
            <span className="w-3 h-3 rounded-sm bg-emerald-800 inline-block" />
            Aumento
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--sl-text-dim)]">
            <span className="w-3 h-3 rounded-sm bg-rose-900 inline-block" />
            Diminuzione
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--sl-text-dim)]">
            <span className="text-[var(--sl-text-dim)] font-bold">—</span>
            <span>Nessun dato</span>
          </span>
        </div>
      )}
    </div>
  );
}
