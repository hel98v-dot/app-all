// src/components/Sparkline.tsx
// Mini-grafico di tendenza generato in SVG (nessuna dipendenza esterna).

import { useId } from 'react';

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Mostra un puntino sull'ultimo valore. */
  dot?: boolean;
}

export function Sparkline({ points, width = 104, height = 30, className, dot = true }: SparklineProps) {
  const gid = useId();
  const n = points.length;
  if (n === 0) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = points.map((p, i) => {
    const x = n === 1 ? width / 2 : pad + (i / (n - 1)) * innerW;
    const y = pad + (1 - (p - min) / range) * innerH;
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const [firstX] = coords[0];
  const [lastX, lastY] = coords[n - 1];
  const area = `${line} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sl-cyan)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--sl-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--sl-cyan)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dot && <circle cx={lastX} cy={lastY} r="2.4" fill="var(--sl-cyan-soft)" />}
    </svg>
  );
}
