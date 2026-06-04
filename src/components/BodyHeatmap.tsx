// src/components/BodyHeatmap.tsx
// Mappa di calore muscolare: due figure anatomiche (fronte / retro) con i
// gruppi muscolari sagomati e colorati in base al volume relativo.
// Il lato sinistro è disegnato una volta e specchiato per garantire simmetria.
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

const BASE       = 'rgba(78,92,112,0.30)';   // corpo neutro (pelle)
const NEUTRAL    = 'rgba(96,114,134,0.20)';  // muscolo senza dato
const OUTLINE    = 'rgba(255,255,255,0.06)'; // bordo corpo neutro
const MUS_STROKE = 'rgba(6,12,24,0.55)';     // separazione tra muscoli
const DEF_STROKE = 'rgba(6,12,24,0.5)';      // linee di definizione (addome, ecc.)

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

// ── Geometria (viewBox 0 0 100 232, asse di simmetria x=50) ─────────────────────
// I path del lato sinistro vengono specchiati con translate(100,0) scale(-1,1).

type MusclePath = { m: Muscle; d: string };

// Corpo neutro condiviso — disegnato sotto i muscoli.
// Parti centrali (simmetriche da sole) e parti sinistre (da specchiare).
const NEUTRAL_CENTER: string[] = [
  // Testa
  'M50,4 C56,4 60,9 60,15 C60,21 56,26 50,26 C44,26 40,21 40,15 C40,9 44,4 50,4 Z',
  // Collo
  'M45,25 L55,25 C55,30 56,33 57,35 L43,35 C44,33 45,30 45,25 Z',
  // Tronco (spalle → bacino)
  'M34,40 C42,36 58,36 66,40 L64,86 C63,104 60,116 57,124 L43,124 C40,116 37,104 36,86 Z',
];
const NEUTRAL_LEFT: string[] = [
  // Braccio superiore
  'M34,42 C27,45 24,54 24,65 C24,76 26,84 30,88 C34,86 36,77 36,66 C36,55 37,47 34,42 Z',
  // Avambraccio
  'M30,87 C26,93 25,103 26,114 C27,121 31,121 34,117 C35,106 35,95 34,88 C33,86 31,86 30,87 Z',
  // Mano
  'M30,118 C27,120 26,126 28,131 C30,134 33,133 34,129 C35,124 34,120 33,118 C32,117 31,117 30,118 Z',
  // Coscia
  'M47,124 C40,128 37,143 37,159 C37,173 40,182 46,185 C49,182 49,168 49,152 C49,136 49,128 48,124 C48,123 47,123 47,124 Z',
  // Polpaccio
  'M46,186 C42,191 41,203 42,215 C43,223 47,223 49,219 C49,206 49,195 48,188 C48,186 47,186 46,186 Z',
  // Piede
  'M44,221 C41,222 39,227 41,230 C44,231 48,231 49,228 L49,223 C48,221 46,221 44,221 Z',
];

// FRONTE — muscoli
const FRONT_CENTER: MusclePath[] = [
  // Addome (retto addominale)
  { m: 'Addome', d: 'M44,64 C44,62 46,61 50,61 C54,61 56,62 56,64 L55,106 C54,111 52,113 50,113 C48,113 46,111 45,106 Z' },
];
const FRONT_LEFT: MusclePath[] = [
  // Deltoide
  { m: 'Spalle',       d: 'M37,40 C30,40 25,45 24,53 C24,60 28,63 33,62 C38,60 40,52 40,45 C40,42 39,40 37,40 Z' },
  // Pettorale
  { m: 'Petto',        d: 'M49,44 C41,43 34,46 32,53 C31,60 36,65 43,64 C48,63 49,58 49,53 Z' },
  // Bicipite
  { m: 'Bicipiti',     d: 'M33,50 C28,53 26,62 27,72 C28,81 32,83 35,79 C37,71 37,60 36,52 C35,50 34,50 33,50 Z' },
  // Quadricipite
  { m: 'Quadricipiti', d: 'M47,126 C41,129 38,144 38,160 C38,172 41,180 46,182 C48,178 49,166 49,150 C49,136 49,129 48,126 Z' },
];
// Linee di definizione fronte (addome segmentato)
const FRONT_DEF: string[] = [
  'M50,64 L50,106',           // linea alba
  'M45,74 L55,74',
  'M45,84 L55,84',
  'M45,94 L55,94',
];

// RETRO — muscoli
const BACK_CENTER: MusclePath[] = [
  // Trapezio (parte alta schiena)
  { m: 'Dorso', d: 'M43,40 C46,38 54,38 57,40 L58,56 C54,60 46,60 42,56 Z' },
];
const BACK_LEFT: MusclePath[] = [
  // Deltoide posteriore
  { m: 'Spalle',    d: 'M37,40 C30,40 25,45 24,53 C24,60 28,63 33,62 C38,60 40,52 40,45 C40,42 39,40 37,40 Z' },
  // Gran dorsale (lat, taglio a V)
  { m: 'Dorso',     d: 'M49,52 C42,52 35,57 34,67 C34,79 41,93 49,97 C49,82 49,67 49,52 Z' },
  // Tricipite
  { m: 'Tricipiti', d: 'M33,50 C28,53 26,62 27,72 C28,81 32,83 35,79 C37,71 37,60 36,52 C35,50 34,50 33,50 Z' },
  // Gluteo
  { m: 'Glutei',    d: 'M49,114 C42,114 37,120 37,129 C37,139 43,145 49,144 C49,134 49,124 49,114 Z' },
  // Femorale (bicipite femorale)
  { m: 'Femorali',  d: 'M47,146 C41,149 38,163 38,178 C38,189 41,196 46,197 C48,193 49,180 49,166 C49,154 49,149 48,146 Z' },
];
const BACK_DEF: string[] = [
  'M50,40 L50,100',           // colonna
];

interface FigureProps {
  label: string;
  center: MusclePath[];
  left: MusclePath[];
  def: string[];
  intensity: Record<Muscle, number>;
  volume: Record<Muscle, number>;
}

function Figure({ label, center, left, def, intensity, volume }: FigureProps) {
  const fill = (m: Muscle) => heatColor(volume[m] ?? 0, intensity[m] ?? 0);
  const Muscles = ({ list }: { list: MusclePath[] }) => (
    <>{list.map(({ m, d }, i) => <path key={`${m}-${i}`} d={d} fill={fill(m)} />)}</>
  );

  return (
    <div className="flex-1 flex flex-col items-center">
      <svg viewBox="0 0 100 232" className="w-full max-w-[150px]" aria-hidden="true">
        {/* Corpo neutro */}
        <g fill={BASE} stroke={OUTLINE} strokeWidth={0.5}>
          {NEUTRAL_CENTER.map((d, i) => <path key={`nc${i}`} d={d} />)}
          {NEUTRAL_LEFT.map((d, i) => <path key={`nl${i}`} d={d} />)}
          <g transform="translate(100,0) scale(-1,1)">
            {NEUTRAL_LEFT.map((d, i) => <path key={`nr${i}`} d={d} />)}
          </g>
        </g>

        {/* Muscoli colorati */}
        <g stroke={MUS_STROKE} strokeWidth={0.7} strokeLinejoin="round">
          <Muscles list={center} />
          <Muscles list={left} />
          <g transform="translate(100,0) scale(-1,1)">
            <Muscles list={left} />
          </g>
        </g>

        {/* Linee di definizione */}
        <g stroke={DEF_STROKE} strokeWidth={0.5} fill="none" strokeLinecap="round" opacity={0.6}>
          {def.map((d, i) => <path key={`d${i}`} d={d} />)}
        </g>
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
        <Figure label="Fronte" center={FRONT_CENTER} left={FRONT_LEFT} def={FRONT_DEF} intensity={intensity} volume={volumeByMuscle} />
        <Figure label="Retro"  center={BACK_CENTER}  left={BACK_LEFT}  def={BACK_DEF}  intensity={intensity} volume={volumeByMuscle} />
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
