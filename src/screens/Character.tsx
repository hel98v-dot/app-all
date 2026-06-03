// src/screens/Character.tsx
// Schermata Personaggio — statistiche RPG, radar SVG, achievement.

import { useEffect, useState } from 'react';
import { Shield, Sword, Ruler } from 'lucide-react';
import { useCharacterStats }   from '../hooks/useCharacterStats';
import {
  ACHIEVEMENTS,
  RATING_COLORS,
  ratingFromValue,
} from '../data/character';
import { BodyweightCard } from '../components/BodyweightCard';
import { MeasurementCard } from '../components/MeasurementCard';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { useCharacterCelebration } from '../hooks/useCharacterCelebration';

// ── Colori tema ───────────────────────────────────────────────────────────────

const GOLD   = '#FFD700';   // riservato agli achievement (rarità "leggendaria")
// Palette "System" (cyan) — usata per radar, barre e livello.
const SYS    = '#38e1ff';
const SYS_T  = 'rgba(56,225,255,0.16)';

// ── Radar SVG ─────────────────────────────────────────────────────────────────

interface RadarProps {
  values: number[];   // 5 valori 0-100, ordine: FORZA, RESISTENZA, COSTANZA, VOLUME, CORE
  animated: boolean;
}

const RADAR_LABELS = ['FORZA', 'RESISTENZA', 'COSTANZA', 'VOLUME', 'CORE'];
const CX = 150, CY = 155, MAX_R = 100;
const ANGLES = RADAR_LABELS.map((_, i) => -90 + i * 72); // in gradi, parte da nord

function polar(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function radarPolygon(values: number[]): string {
  return values
    .map((v, i) => polar(ANGLES[i]!, (v / 100) * MAX_R))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

function gridPolygon(pct: number): string {
  return ANGLES
    .map(a => polar(a, MAX_R * pct))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

// Offset etichette: le spingiamo oltre MAX_R in base all'angolo
const LABEL_OFFSETS: Array<{ dx: number; dy: number; anchor: 'middle' | 'start' | 'end' }> = [
  { dx:  0,  dy: -18, anchor: 'middle' }, // FORZA — top
  { dx:  14, dy: -6,  anchor: 'start'  }, // RESISTENZA — destra alta
  { dx:  10, dy:  16, anchor: 'start'  }, // COSTANZA — destra bassa
  { dx: -10, dy:  16, anchor: 'end'    }, // VOLUME — sinistra bassa
  { dx: -14, dy: -6,  anchor: 'end'    }, // CORE — sinistra alta
];

function RadarChart({ values, animated }: RadarProps) {
  const display = animated ? values : values.map(() => 0);

  return (
    <svg
      viewBox="0 0 300 310"
      className="w-full max-w-[300px] mx-auto"
      aria-hidden="true"
    >
      {/* Grid lines */}
      {[0.2, 0.4, 0.6, 0.8, 1.0].map(pct => (
        <polygon
          key={pct}
          points={gridPolygon(pct)}
          fill="none"
          stroke={pct === 1.0 ? 'rgba(56,225,255,0.35)' : 'rgba(56,225,255,0.08)'}
          strokeWidth={pct === 1.0 ? 1.5 : 1}
        />
      ))}

      {/* Assi radiali */}
      {ANGLES.map((angle, i) => {
        const [x, y] = polar(angle, MAX_R);
        return (
          <line
            key={i}
            x1={CX} y1={CY} x2={x} y2={y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}

      {/* Area stat */}
      <polygon
        points={radarPolygon(display)}
        fill={SYS_T}
        stroke={SYS}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(56,225,255,0.5))', transition: animated ? 'none' : 'points 600ms ease-out' }}
      />

      {/* Punto centrale */}
      <circle cx={CX} cy={CY} r={3} fill={SYS} />

      {/* Etichette angoli */}
      {ANGLES.map((angle, i) => {
        const [x, y] = polar(angle, MAX_R + 18);
        const off    = LABEL_OFFSETS[i]!;
        const val    = values[i]!;

        return (
          <g key={i}>
            <text
              x={x + off.dx}
              y={y + off.dy}
              textAnchor={off.anchor}
              fontSize={9}
              fontWeight="700"
              letterSpacing="0.05em"
              fill="rgba(148,163,184,0.9)"
            >
              {RADAR_LABELS[i]}
            </text>
            <text
              x={x + off.dx}
              y={y + off.dy + 13}
              textAnchor={off.anchor}
              fontSize={12}
              fontWeight="800"
              fill={SYS}
            >
              {val}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Barra stat orizzontale ────────────────────────────────────────────────────

interface StatBarProps {
  label: string;
  icon:  string;
  desc:  string;
  value: number;
  animated: boolean;
}

function StatBar({ label, icon, desc, value, animated }: StatBarProps) {
  const rating  = ratingFromValue(value);
  const { bg, text } = RATING_COLORS[rating];

  return (
    <div className="sl-panel rounded-2xl px-4 py-3.5 space-y-2">
      <div className="flex items-center gap-3">
        {/* Icona + nome */}
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="sl-label text-xs text-slate-100">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums sl-display" style={{ color: SYS }}>{value}</span>
              <span
                className="sl-rank inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs"
                style={{ backgroundColor: bg, color: text }}
              >
                {rating}
              </span>
            </div>
          </div>
          {/* Barra */}
          <div className="h-2 rounded-full bg-[rgba(8,14,28,0.8)] overflow-hidden border border-[var(--sl-line-soft)]">
            <div
              className="h-full rounded-full"
              style={{
                width: animated ? `${value}%` : '0%',
                background: `linear-gradient(90deg, ${SYS}, ${SYS})`,
                boxShadow: '0 0 10px rgba(56,225,255,0.6)',
                transition: 'width 700ms cubic-bezier(0.34,1.2,0.64,1)',
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--sl-text-dim)] pl-8">{desc}</p>
    </div>
  );
}

// ── Card achievement ──────────────────────────────────────────────────────────

interface AchievementCardProps {
  icon:         string;
  name:         string;
  description:  string;
  hint:         string;
  unlocked:     boolean;
}

function AchievementCard({ icon, name, description, hint, unlocked }: AchievementCardProps) {
  return (
    <div
      className={[
        'rounded-2xl border px-4 py-3.5 flex items-start gap-3 transition-all',
        unlocked
          ? 'bg-[rgba(30,28,16,0.55)] border-yellow-600/40 backdrop-blur-sm'
          : 'bg-[rgba(8,12,22,0.5)] border-[var(--sl-line-soft)] opacity-45 backdrop-blur-sm',
      ].join(' ')}
      style={unlocked ? {
        boxShadow: '0 0 12px rgba(255,215,0,0.12)',
      } : undefined}
    >
      <span className={`text-3xl shrink-0 ${unlocked ? '' : 'grayscale'}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${unlocked ? 'text-yellow-300' : 'text-slate-500'}`}>
          {name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        {unlocked && (
          <p className="text-xs mt-1 font-medium" style={{ color: GOLD }}>
            ✓ {hint}
          </p>
        )}
      </div>
      {unlocked && (
        <div
          className="shrink-0 w-2 h-2 rounded-full mt-1 animate-pulse"
          style={{ backgroundColor: GOLD }}
        />
      )}
    </div>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────

const STAT_META = [
  { key: 'forza'      as const, icon: '⚔️',  label: 'FORZA',      desc: 'Miglior serie sui big lift vs livello avanzato' },
  { key: 'resistenza' as const, icon: '🫁',  label: 'RESISTENZA', desc: 'Reps e volume sui range alti vs livello avanzato' },
  { key: 'costanza'   as const, icon: '🎯',  label: 'COSTANZA',   desc: 'Sessioni completate su 25 totali del mesociclo' },
  { key: 'volume'     as const, icon: '📦',  label: 'VOLUME',     desc: 'Volume totale vs massimo a carichi avanzati' },
  { key: 'core'       as const, icon: '🛡️',  label: 'CORE',       desc: 'Performance sugli anti-movement vs avanzato' },
];

export function Character() {
  const { isStale, ...stats } = useCharacterStats();

  // Trigger animazione barre al montaggio
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const hasData    = stats.raw.volMesocycle > 0 || stats.raw.sessionsCompleted > 0;
  const globalRating = ratingFromValue(stats.globalLevel);
  const { bg: glBg, text: glText } = RATING_COLORS[globalRating];

  // Celebrazione di nuovi achievement / level-up
  const { celebration, dismiss } = useCharacterCelebration(
    stats.unlockedAchievements, stats.globalLevel, hasData,
  );

  // ── Placeholder ─────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] gap-5 px-8 text-center">
        <div className="flex gap-3">
          <Sword  size={40} className="text-slate-700" strokeWidth={1.25} />
          <Shield size={40} className="text-slate-700" strokeWidth={1.25} />
        </div>
        <h1 className="sl-heading text-2xl">Status</h1>
        <p className="text-[var(--sl-text-dim)] max-w-xs text-sm leading-relaxed">
          Nessun dato. Completa le tue missioni per far emergere lo Status del Player —
          ogni kg sollevato costruisce le tue statistiche.
        </p>
      </div>
    );
  }

  // ── Schermata completa ───────────────────────────────────────────────────────
  return (
    <div className={['px-4 pt-5 pb-10 max-w-lg mx-auto space-y-5', isStale ? 'opacity-60' : ''].join(' ')}>

      {/* ── Titolo ──────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-1">
        <p className="sl-label text-[10px] text-[var(--sl-cyan)] sl-glow-text">▣ Player Status</p>
        <h1 className="sl-heading text-2xl">Status</h1>
      </div>

      {/* ── Card livello globale (finestra System) ───────────────────────────── */}
      <div className="sl-panel sl-topline rounded-2xl px-5 py-5 space-y-3 sl-sweep">
        <div className="flex items-center gap-4">
          {/* Numero livello */}
          <div className="flex flex-col items-center leading-none">
            <span className="sl-label text-[9px] text-[var(--sl-text-dim)] mb-1">Livello</span>
            <span
              className="text-6xl font-black tabular-nums leading-none sl-display sl-glow-text"
              style={{ color: SYS }}
            >
              {stats.globalLevel}
            </span>
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="sl-label text-[10px] text-[var(--sl-text-dim)]">
                Hunter Rank
              </span>
              {/* Rating badge grande */}
              <span
                className="sl-rank text-lg px-3 py-0.5 rounded-lg"
                style={{ backgroundColor: glBg, color: glText }}
              >
                {globalRating}
              </span>
            </div>
            <p className="text-xs text-[var(--sl-text-dim)]">
              {stats.xp.toLocaleString('it-IT')} XP totali
            </p>
          </div>
        </div>

        {/* Barra progresso livello */}
        <div className="h-3 rounded-full bg-[rgba(8,14,28,0.85)] overflow-hidden border border-[var(--sl-line-soft)]">
          <div
            className="h-full rounded-full"
            style={{
              width: animated ? `${stats.globalLevel}%` : '0%',
              background: `linear-gradient(90deg, var(--sl-violet), ${SYS})`,
              boxShadow: '0 0 12px rgba(56,225,255,0.55)',
              transition: 'width 800ms cubic-bezier(0.34,1.1,0.64,1)',
            }}
          />
        </div>

        {/* Mini stat row */}
        <div className="flex justify-between pt-1">
          {STAT_META.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-0.5">
              <span className="sl-label text-[9px] text-[var(--sl-text-dim)]">{label.slice(0, 3)}</span>
              <span className="text-sm font-bold sl-display" style={{ color: stats[key] >= 60 ? SYS : 'rgb(125,151,173)' }}>
                {stats[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Radar chart ──────────────────────────────────────────────────────── */}
      <div className="sl-panel rounded-2xl py-4 px-2">
        <RadarChart
          values={[stats.forza, stats.resistenza, stats.costanza, stats.volume, stats.core]}
          animated={animated}
        />
      </div>

      {/* ── Stat bars ────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {STAT_META.map(({ key, icon, label, desc }) => (
          <StatBar
            key={key}
            icon={icon}
            label={label}
            desc={desc}
            value={stats[key]}
            animated={animated}
          />
        ))}
      </div>

      {/* ── Corpo ────────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-1">
        <h2 className="sl-heading text-base flex items-center gap-2">
          <span>⚖️</span> Corpo
        </h2>
        <BodyweightCard />
        <MeasurementCard
          storageName="waist"
          title="Circonferenza vita"
          unit="cm"
          step={0.5}
          min={40}
          defaultValue={80}
          icon={<Ruler size={14} className="text-[var(--sl-cyan)]" />}
        />
      </div>

      {/* ── Achievement ──────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-1">
        <h2 className="sl-heading text-base flex items-center gap-2">
          <span>🏆</span> Achievement
        </h2>
        <div className="space-y-2.5">
          {ACHIEVEMENTS.map(ach => (
            <AchievementCard
              key={ach.id}
              icon={ach.icon}
              name={ach.name}
              description={ach.description}
              hint={ach.hint}
              unlocked={stats.unlockedAchievements.includes(ach.id)}
            />
          ))}
        </div>
      </div>

      {celebration && (
        <CelebrationOverlay
          achievements={celebration.achievements}
          levelUp={celebration.levelUp}
          onClose={dismiss}
        />
      )}
    </div>
  );
}
