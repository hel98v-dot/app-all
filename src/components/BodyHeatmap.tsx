// src/components/BodyHeatmap.tsx
// Mappa di calore muscolare: due silhouette stilizzate (fronte / retro)
// con le regioni muscolari colorate in base al volume relativo.
// Riceve il volume per muscolo del periodo selezionato e normalizza
// l'intensità sul muscolo più allenato (max = 1).

import type { Muscle } from '../data/program';

// ── Scala di calore ────────────────────────────────────────────────────────────
// Da freddo (poco volume) a caldo (molto volume): blu → cyan → ambra → rosso.
const HEAT_STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [30, 58, 95]],     // blu profondo
  [0.4, [56, 225, 255]],   // cyan "System"
  [0.7, [245, 200, 16]],   // ambra
  [1.0, [255, 77, 109]],   // rosso/magenta
];

const NEUTRAL = 'rgba(110,130,150,0.14)';   // parti non muscolari / senza dato
const OUTLINE = 'rgba(255,255,255,0.07)';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Colore di calore per intensità 0..1. value 0 → grigio spento. */
function heatColor(value: number, intensity: number): string {
  if (value <= 0) return NEUTRAL;
  const t = Math.max(0.12, Math.min(1, intensity));   // floor per restare visibile
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [p1, c1] = HEAT_STOPS[i]!;
    const [p0, c0] = HEAT_STOPS[i - 1]!;
    if (t <= p1) {
      const k = (t - p0) / (p1 - p0);
      const r = Math.round(lerp(c0[0], c1[0], k));
      const g = Math.round(lerp(c0[1], c1[1], k));
      const b = Math.round(lerp(c0[2], c1[2], k));
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(255,77,109)';
}

// ── Geometria delle figure ─────────────────────────────────────────────────────

type Shape =
  | { k: 'ell'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number };

const ell  = (cx: number, cy: number, rx: number, ry: number): Shape => ({ k: 'ell', cx, cy, rx, ry });
const rect = (x: number, y: number, w: number, h: number, r: number): Shape => ({ k: 'rect', x, y, w, h, r });

// Parti non muscolari condivise (testa, collo, avambracci, polpacci, piedi)
const NEUTRAL_PARTS: Shape[] = [
  ell(55, 20, 12, 14),                 // testa
  rect(50, 31, 10, 9, 3),              // collo
  ell(26, 93, 5, 16), ell(84, 93, 5, 16),   // avambracci
  ell(24, 110, 4.5, 7), ell(86, 110, 4.5, 7), // mani
  ell(47, 185, 7, 22), ell(63, 185, 7, 22),   // polpacci
  ell(47, 211, 5.5, 6), ell(63, 211, 5.5, 6), // piedi
];

// Regioni muscolari — vista FRONTE
const FRONT_MUSCLES: Array<{ m: Muscle; shapes: Shape[] }> = [
  { m: 'Spalle',       shapes: [ell(36, 47, 11, 9), ell(74, 47, 11, 9)] },
  { m: 'Petto',        shapes: [ell(46, 58, 9.5, 8), ell(64, 58, 9.5, 8)] },
  { m: 'Addome',       shapes: [rect(46, 68, 18, 42, 7)] },
  { m: 'Bicipiti',     shapes: [ell(30, 67, 6.5, 16), ell(80, 67, 6.5, 16)] },
  { m: 'Quadricipiti', shapes: [ell(47, 136, 9, 25), ell(63, 136, 9, 25)] },
];

// Regioni muscolari — vista RETRO
const BACK_MUSCLES: Array<{ m: Muscle; shapes: Shape[] }> = [
  { m: 'Spalle',    shapes: [ell(36, 47, 11, 9), ell(74, 47, 11, 9)] },
  { m: 'Dorso',     shapes: [rect(41, 50, 28, 50, 9)] },
  { m: 'Tricipiti', shapes: [ell(30, 67, 6.5, 16), ell(80, 67, 6.5, 16)] },
  { m: 'Glutei',    shapes: [ell(48, 111, 9, 11), ell(62, 111, 9, 11)] },
  { m: 'Femorali',  shapes: [ell(47, 150, 9, 23), ell(63, 150, 9, 23)] },
];

function ShapeNode({ shape, fill }: { shape: Shape; fill: string }) {
  if (shape.k === 'ell') {
    return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fill} stroke={OUTLINE} strokeWidth={0.8} />;
  }
  return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill={fill} stroke={OUTLINE} strokeWidth={0.8} />;
}

interface FigureProps {
  label: string;
  muscles: Array<{ m: Muscle; shapes: Shape[] }>;
  intensity: Record<Muscle, number>;
  volume: Record<Muscle, number>;
}

function Figure({ label, muscles, intensity, volume }: FigureProps) {
  return (
    <div className="flex-1 flex flex-col items-center">
      <svg viewBox="0 0 110 224" className="w-full max-w-[150px]" aria-hidden="true">
        {/* Parti neutre sotto */}
        {NEUTRAL_PARTS.map((s, i) => <ShapeNode key={`n${i}`} shape={s} fill={NEUTRAL} />)}
        {/* Regioni muscolari */}
        {muscles.map(({ m, shapes }) =>
          shapes.map((s, i) => (
            <ShapeNode key={`${m}-${i}`} shape={s} fill={heatColor(volume[m] ?? 0, intensity[m] ?? 0)} />
          )),
        )}
      </svg>
      <span className="sl-label text-[10px] text-[var(--sl-text-dim)] mt-1">{label}</span>
    </div>
  );
}

// ── Componente pubblico ─────────────────────────────────────────────────────────

export function BodyHeatmap({ volumeByMuscle }: { volumeByMuscle: Record<Muscle, number> }) {
  const max = Math.max(0, ...Object.values(volumeByMuscle));
  const intensity = Object.fromEntries(
    Object.entries(volumeByMuscle).map(([m, v]) => [m, max > 0 ? v / max : 0]),
  ) as Record<Muscle, number>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Figure label="Fronte" muscles={FRONT_MUSCLES} intensity={intensity} volume={volumeByMuscle} />
        <Figure label="Retro"  muscles={BACK_MUSCLES}  intensity={intensity} volume={volumeByMuscle} />
      </div>

      {/* Legenda scala di calore */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-[var(--sl-text-dim)]">meno</span>
        <div
          className="flex-1 h-2 rounded-full"
          style={{ background: 'linear-gradient(90deg, rgb(30,58,95), rgb(56,225,255), rgb(245,200,16), rgb(255,77,109))' }}
        />
        <span className="text-[10px] text-[var(--sl-text-dim)]">più</span>
      </div>
    </div>
  );
}
