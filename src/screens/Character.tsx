// src/screens/Character.tsx
// Schermata Personaggio — statistiche RPG, radar SVG, achievement.

import { useEffect, useState } from 'react';
import { Shield, Sword }       from 'lucide-react';
import { useCharacterStats }   from '../hooks/useCharacterStats';
import {
  ACHIEVEMENTS,
  RATING_COLORS,
  ratingFromValue,
} from '../data/character';

// ── Colori tema ───────────────────────────────────────────────────────────────

const GOLD   = '#FFD700';
const GOLD_T = 'rgba(255,215,0,0.18)';  // gold semitrasparente per il fill radar

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
          stroke={pct === 1.0 ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.07)'}
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
        fill={GOLD_T}
        stroke={GOLD}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ transition: animated ? 'none' : 'points 600ms ease-out' }}
      />

      {/* Punto centrale */}
      <circle cx={CX} cy={CY} r={3} fill={GOLD} />

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
              fill={GOLD}
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
    <div className="bg-slate-800 border border-slate-700/60 rounded-2xl px-4 py-3.5 space-y-2">
      <div className="flex items-center gap-3">
        {/* Icona + nome */}
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-slate-100 tracking-wide">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums" style={{ color: GOLD }}>{value}</span>
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black"
                style={{ backgroundColor: bg, color: text }}
              >
                {rating}
              </span>
            </div>
          </div>
          {/* Barra */}
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: animated ? `${value}%` : '0%',
                background: `linear-gradient(90deg, #6366f1, ${GOLD})`,
                transition: 'width 700ms cubic-bezier(0.34,1.2,0.64,1)',
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500 pl-8">{desc}</p>
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
          ? 'bg-slate-800 border-yellow-600/40'
          : 'bg-slate-900 border-slate-800 opacity-45',
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
  { key: 'forza'      as const, icon: '⚔️',  label: 'FORZA',      desc: 'Volume sui 5 esercizi multiarticolari principali' },
  { key: 'resistenza' as const, icon: '🫁',  label: 'RESISTENZA', desc: 'Volume su esercizi ad alto numero di reps e carries' },
  { key: 'costanza'   as const, icon: '🎯',  label: 'COSTANZA',   desc: 'Sessioni completate su 25 totali del mesociclo' },
  { key: 'volume'     as const, icon: '📦',  label: 'VOLUME',     desc: 'Volume totale del mesociclo (proxy crescita muscolare)' },
  { key: 'core'       as const, icon: '🛡️',  label: 'CORE',       desc: 'Volume sugli esercizi anti-movement per la lombare' },
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

  // ── Placeholder ─────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] gap-5 px-8 text-center">
        <div className="flex gap-3">
          <Sword  size={40} className="text-slate-700" strokeWidth={1.25} />
          <Shield size={40} className="text-slate-700" strokeWidth={1.25} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>⚔ PERSONAGGIO</h1>
        <p className="text-slate-400 max-w-xs text-sm leading-relaxed">
          Inizia ad allenarti per vedere il tuo personaggio prendere vita.
          Ogni kg sollevato costruisce le tue statistiche.
        </p>
      </div>
    );
  }

  // ── Schermata completa ───────────────────────────────────────────────────────
  return (
    <div className={['px-4 pt-5 pb-10 max-w-lg mx-auto space-y-5', isStale ? 'opacity-60' : ''].join(' ')}>

      {/* ── Titolo ──────────────────────────────────────────────────────────── */}
      <h1
        className="text-center text-xl font-black tracking-[0.15em] uppercase"
        style={{ color: GOLD }}
      >
        ⚔ PERSONAGGIO
      </h1>

      {/* ── Card livello globale ─────────────────────────────────────────────── */}
      <div
        className="rounded-3xl border border-yellow-700/40 px-5 py-5 space-y-3"
        style={{
          background: 'linear-gradient(135deg, rgba(30,27,20,0.95), rgba(20,20,30,0.95))',
          boxShadow: '0 0 24px rgba(255,215,0,0.08)',
        }}
      >
        <div className="flex items-center gap-4">
          {/* Numero livello */}
          <span
            className="text-6xl font-black tabular-nums leading-none"
            style={{ color: GOLD }}
          >
            {stats.globalLevel}
          </span>

          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                Livello Globale
              </span>
              {/* Rating badge grande */}
              <span
                className="text-base font-black px-2.5 py-0.5 rounded-lg"
                style={{ backgroundColor: glBg, color: glText }}
              >
                {globalRating}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {stats.xp.toLocaleString('it-IT')} XP totali
            </p>
          </div>
        </div>

        {/* Barra progresso livello */}
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: animated ? `${stats.globalLevel}%` : '0%',
              background: `linear-gradient(90deg, #3730a3, #6366f1, ${GOLD})`,
              transition: 'width 800ms cubic-bezier(0.34,1.1,0.64,1)',
            }}
          />
        </div>

        {/* Mini stat row */}
        <div className="flex justify-between pt-1">
          {STAT_META.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label.slice(0, 3)}</span>
              <span className="text-sm font-bold" style={{ color: stats[key] >= 60 ? GOLD : 'rgb(148,163,184)' }}>
                {stats[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Radar chart ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl py-4 px-2">
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

      {/* ── Achievement ──────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-1">
        <h2
          className="text-base font-black tracking-wider uppercase"
          style={{ color: GOLD }}
        >
          🏆 ACHIEVEMENT
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
    </div>
  );
}
