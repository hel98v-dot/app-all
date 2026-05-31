// src/screens/ProfileSelect.tsx
// Schermata "risveglio" — registrazione / selezione Player (stile System).
import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Profile } from '../types';
import { ThemeBackground } from '../components/ThemeBackground';

interface Props {
  profiles:  Profile[];
  onCreate:  (name: string) => void;
  onSelect:  (id: string) => void;
}

export function ProfileSelect({ profiles, onCreate, onSelect }: Props) {
  const [name, setName] = useState('');
  const hasProfiles = profiles.length > 0;

  function handleCreate() {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <ThemeBackground keys={['global']} />

      <div className="relative w-full max-w-sm space-y-8">

        {/* Intestazione System */}
        <div className="text-center space-y-3">
          <p className="sl-label text-[11px] text-[var(--sl-cyan)] sl-glow-text">▣ System Online</p>
          <h1 className="sl-heading text-3xl">Arise</h1>
          <p className="text-[var(--sl-text-dim)] text-sm" style={{ fontFamily: 'var(--font-ui)' }}>
            {hasProfiles ? 'Seleziona il tuo Player' : 'Sei stato scelto. Registra il tuo Player per iniziare.'}
          </p>
        </div>

        {/* Player esistenti */}
        {hasProfiles && (
          <div className="space-y-2.5">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="sl-panel w-full flex items-center gap-4 px-4 py-4 min-h-[64px]
                  text-left active:brightness-125 transition"
              >
                <div className="w-11 h-11 rounded-lg bg-[rgba(56,225,255,0.08)] border border-[var(--sl-line)]
                  flex items-center justify-center shrink-0 sl-display text-[var(--sl-cyan-soft)] text-lg">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-100 truncate" style={{ fontFamily: 'var(--font-ui)' }}>{p.name}</p>
                  <p className="sl-label text-[9px] text-[var(--sl-text-dim)]">Player</p>
                </div>
                <ChevronRight size={18} className="text-[var(--sl-cyan)] shrink-0" />
              </button>
            ))}
          </div>
        )}

        {hasProfiles && (
          <div className="flex items-center gap-3">
            <div className="flex-1 sl-divider" />
            <span className="sl-label text-[9px] text-[var(--sl-text-dim)]">oppure</span>
            <div className="flex-1 sl-divider" />
          </div>
        )}

        {/* Registrazione nuovo Player */}
        <div className="space-y-3">
          <p className="sl-label text-[10px] text-[var(--sl-text-dim)]">
            {hasProfiles ? 'Nuovo Player' : 'Nome del Player'}
          </p>
          <input
            type="text"
            placeholder="Es. Sung Jin-Woo, Marco…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            maxLength={30}
            className="w-full bg-[rgba(8,14,28,0.7)] border border-[var(--sl-line)] rounded-xl
              px-4 py-4 text-slate-100 text-base placeholder:text-[var(--sl-text-dim)]
              focus:outline-none focus:border-[var(--sl-cyan)]
              focus:shadow-[0_0_18px_var(--sl-glow)] transition-shadow"
            style={{ fontFamily: 'var(--font-ui)' }}
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="sl-btn w-full flex items-center justify-center gap-2 py-4 min-h-[56px] rounded-xl text-base"
          >
            <Plus size={20} strokeWidth={2.5} />
            {hasProfiles ? 'Registra Player' : 'Risvegliati'}
          </button>
        </div>

      </div>
    </div>
  );
}
