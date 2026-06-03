// src/components/CelebrationOverlay.tsx
// Overlay celebrativo per nuovi achievement sbloccati e/o level-up.

import { createPortal } from 'react-dom';
import { X, Trophy, ChevronsUp } from 'lucide-react';
import { RATING_COLORS, type AchievementDef, type Rating } from '../data/character';

interface Props {
  achievements: AchievementDef[];
  levelUp: Rating | null;
  onClose: () => void;
}

export function CelebrationOverlay({ achievements, levelUp, onClose }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/80" />

      <div className="relative sl-panel sl-topline rounded-3xl px-6 py-7 max-w-sm w-full text-center sl-sweep">
        <div className="sl-pulse inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3
          bg-[rgba(255,215,0,0.12)] border border-yellow-600/40">
          {levelUp
            ? <ChevronsUp size={32} className="text-[var(--sl-cyan)]" strokeWidth={2.5} />
            : <Trophy size={30} className="text-yellow-400" />}
        </div>

        <h2 className="sl-heading text-xl">
          {levelUp ? 'Level Up!' : 'Achievement Sbloccato!'}
        </h2>

        {levelUp && (
          <p className="text-sm text-[var(--sl-text-dim)] mt-2 flex items-center justify-center gap-2">
            Nuovo rango:
            <span
              className="sl-rank inline-flex items-center justify-center w-8 h-8 rounded-lg text-base"
              style={{ backgroundColor: RATING_COLORS[levelUp].bg, color: RATING_COLORS[levelUp].text }}
            >
              {levelUp}
            </span>
          </p>
        )}

        {achievements.length > 0 && (
          <div className="space-y-2 mt-4">
            {achievements.map(a => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left
                  bg-[rgba(30,28,16,0.55)] border border-yellow-600/40"
              >
                <span className="text-3xl shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-yellow-300">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="sl-btn w-full mt-5 py-3 rounded-2xl min-h-[52px] flex items-center justify-center gap-2"
        >
          <X size={18} strokeWidth={2.5} /> Continua
        </button>
      </div>
    </div>,
    document.body,
  );
}
