// src/hooks/useProfileStore.ts
// Gestione profili utente. Ogni profilo ha log e scheda separati.

import { useCallback, useState } from 'react';
import type { Profile, ProfileStore } from '../types';

const PROFILES_KEY = 'profiles-v1';

// ── Helpers puri ──────────────────────────────────────────────────────────────

function readStore(): ProfileStore {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProfileStore;
      if (Array.isArray(parsed.profiles) && parsed.activeId) return parsed;
    }
  } catch { /* ignore */ }
  return { profiles: [], activeId: '' };
}

function writeStore(s: ProfileStore): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(s));
}

export function createProfile(name: string): Profile {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
}

/** Chiave localStorage per i log di un profilo. */
export function logKey(profileId: string): string {
  // Backward-compat: il profilo "default" usa la chiave storica senza suffisso
  return profileId === 'default'
    ? 'training-log-v1'
    : `training-log-v1-${profileId}`;
}

/** Chiave localStorage per il programma personalizzato di un profilo. */
export function customProgramKey(profileId: string): string {
  return `custom-program-v1-${profileId}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseProfileStoreReturn {
  profiles:       Profile[];
  activeProfile:  Profile | null;
  /** Crea un profilo e lo rende attivo. */
  createAndActivate: (name: string) => Profile;
  /** Cambia profilo attivo — ricarica la pagina per re-inizializzare i hook. */
  switchProfile:  (id: string) => void;
  /** Rinomina il profilo attivo. */
  renameActive:   (name: string) => void;
  /** Elimina un profilo e tutti i suoi dati. */
  deleteProfile:  (id: string) => void;
}

export function useProfileStore(): UseProfileStoreReturn {
  const [store, setStore] = useState<ProfileStore>(readStore);

  const commit = useCallback((next: ProfileStore) => {
    writeStore(next);
    setStore(next);
  }, []);

  const activeProfile = store.profiles.find(p => p.id === store.activeId) ?? null;

  const createAndActivate = useCallback((name: string): Profile => {
    const p = createProfile(name);
    const next: ProfileStore = {
      profiles: [...store.profiles, p],
      activeId: p.id,
    };
    commit(next);
    return p;
  }, [store, commit]);

  const switchProfile = useCallback((id: string) => {
    const next: ProfileStore = { ...store, activeId: id };
    writeStore(next);
    // Ricarica per re-inizializzare tutti gli hook con il nuovo profilo
    window.location.reload();
  }, [store]);

  const renameActive = useCallback((name: string) => {
    const next: ProfileStore = {
      ...store,
      profiles: store.profiles.map(p =>
        p.id === store.activeId ? { ...p, name: name.trim() } : p,
      ),
    };
    commit(next);
  }, [store, commit]);

  const deleteProfile = useCallback((id: string) => {
    // Rimuove log e programma del profilo
    localStorage.removeItem(logKey(id));
    localStorage.removeItem(customProgramKey(id));

    const remaining = store.profiles.filter(p => p.id !== id);
    const newActiveId = id === store.activeId
      ? (remaining[0]?.id ?? '')
      : store.activeId;

    const next: ProfileStore = { profiles: remaining, activeId: newActiveId };
    writeStore(next);
    window.location.reload();
  }, [store]);

  return {
    profiles: store.profiles,
    activeProfile,
    createAndActivate,
    switchProfile,
    renameActive,
    deleteProfile,
  };
}
