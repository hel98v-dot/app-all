// src/screens/ProfileSelect.tsx
// Mostrata al primo avvio o quando nessun profilo è attivo.
import { useState } from 'react';
import { User, Plus, ChevronRight } from 'lucide-react';
import type { Profile } from '../types';

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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🏋️</div>
          <h1 className="text-2xl font-bold text-slate-100">App Allenamento</h1>
          <p className="text-slate-400 text-sm">
            {hasProfiles ? 'Seleziona il tuo profilo' : 'Chi sei? Crea il tuo profilo per iniziare.'}
          </p>
        </div>

        {/* Profili esistenti */}
        {hasProfiles && (
          <div className="space-y-2">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="w-full flex items-center gap-4 px-4 py-4 min-h-[64px]
                  bg-slate-800 border border-slate-700 rounded-2xl
                  text-left active:bg-slate-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-900/60 border border-indigo-700/50
                  flex items-center justify-center shrink-0">
                  <User size={20} className="text-indigo-400" />
                </div>
                <span className="flex-1 font-semibold text-slate-100">{p.name}</span>
                <ChevronRight size={18} className="text-slate-500 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Divisore */}
        {hasProfiles && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500">oppure</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
        )}

        {/* Crea nuovo profilo */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {hasProfiles ? 'Aggiungi profilo' : 'Il tuo nome'}
          </p>
          <input
            type="text"
            placeholder="Es. Marco, Fratello…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            maxLength={30}
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl
              px-4 py-4 text-slate-100 text-base placeholder:text-slate-500
              focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className={[
              'w-full flex items-center justify-center gap-2 py-4 min-h-[56px]',
              'rounded-2xl font-bold text-base transition-colors',
              name.trim()
                ? 'bg-indigo-600 active:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-600',
            ].join(' ')}
          >
            <Plus size={20} strokeWidth={2.5} />
            {hasProfiles ? 'Crea profilo' : 'Inizia'}
          </button>
        </div>

      </div>
    </div>
  );
}
