// src/hooks/useCharacterCelebration.ts
// Rileva nuovi achievement sbloccati e i level-up confrontando lo stato
// corrente con uno snapshot "visto" salvato per profilo. Alla prima esecuzione
// inizializza lo snapshot senza celebrare (niente celebrazioni retroattive).

import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, ratingFromValue, type AchievementDef, type Rating } from '../data/character';

const RATING_ORDER: Rating[] = ['D', 'C', 'B', 'A', 'S'];

function getActiveProfileId(): string {
  try {
    const raw = localStorage.getItem('profiles-v1');
    if (raw) {
      const s = JSON.parse(raw) as { activeId?: string };
      if (s.activeId) return s.activeId;
    }
  } catch { /* ignore */ }
  return 'default';
}

const KEY = `character-seen-v1-${getActiveProfileId()}`;

interface Seen { achievements: string[]; level: number; }

function readSeen(): Seen | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Seen;
  } catch { /* ignore */ }
  return null;
}

function writeSeen(s: Seen): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface Celebration {
  achievements: AchievementDef[];
  levelUp: Rating | null;
}

export interface UseCelebrationReturn {
  celebration: Celebration | null;
  dismiss: () => void;
}

export function useCharacterCelebration(
  unlocked: string[],
  globalLevel: number,
  hasData: boolean,
): UseCelebrationReturn {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const sig = unlocked.join(',');

  useEffect(() => {
    if (!hasData) return;
    const seen = readSeen();

    if (!seen) {
      // Prima volta: registra lo stato attuale, niente celebrazione
      writeSeen({ achievements: unlocked, level: globalLevel });
      return;
    }

    const newIds = unlocked.filter(id => !seen.achievements.includes(id));
    const leveledUp =
      RATING_ORDER.indexOf(ratingFromValue(globalLevel)) >
      RATING_ORDER.indexOf(ratingFromValue(seen.level));

    if (newIds.length > 0 || leveledUp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCelebration({
        achievements: ACHIEVEMENTS.filter(a => newIds.includes(a.id)),
        levelUp: leveledUp ? ratingFromValue(globalLevel) : null,
      });
      if ('vibrate' in navigator) navigator.vibrate([60, 40, 60, 40, 140]);
    }

    writeSeen({ achievements: unlocked, level: globalLevel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, globalLevel, hasData]);

  return { celebration, dismiss: () => setCelebration(null) };
}
