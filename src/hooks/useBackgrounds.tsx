/* eslint-disable react-refresh/only-export-components */
// src/hooks/useBackgrounds.tsx
// Context per gli sfondi immagine caricati dall'utente.
// Carica i Blob da IndexedDB una sola volta, li espone come object URL,
// e offre set/clear + un resolver per ordine di priorità delle chiavi.

import {
  createContext, useCallback, useContext,
  useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { idbGetAll, idbSet, idbDelete } from '../lib/idb';
import { resizeImage } from '../lib/imageResize';

// Chiavi note (documentate per chiarezza):
//   'global'                 → sfondo di tutta l'app
//   'page:today' | 'page:history' | 'page:volume' | 'page:character' | 'page:settings'
//   'exercise-default'       → sfondo di tutte le schermate esercizio
//   'exercise:<exerciseId>'  → sfondo di un singolo esercizio

interface BackgroundsContextValue {
  urls: Record<string, string>;        // chiave → object URL
  ready: boolean;
  setBackground:   (key: string, file: File) => Promise<void>;
  clearBackground: (key: string) => Promise<void>;
  /** Restituisce il primo object URL disponibile tra le chiavi date. */
  resolve: (keys: string[]) => string | null;
}

const BackgroundsContext = createContext<BackgroundsContextValue | null>(null);

export function BackgroundsProvider({ children }: { children: ReactNode }) {
  const [urls, setUrls]   = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  // Tiene traccia degli object URL per revocarli quando vengono sostituiti.
  const urlsRef = useRef<Record<string, string>>({});

  // Caricamento iniziale da IndexedDB
  useEffect(() => {
    let alive = true;
    idbGetAll()
      .then(blobs => {
        if (!alive) return;
        const next: Record<string, string> = {};
        for (const [k, blob] of Object.entries(blobs)) {
          next[k] = URL.createObjectURL(blob);
        }
        urlsRef.current = next;
        setUrls(next);
        setReady(true);
      })
      .catch(() => setReady(true));

    return () => {
      alive = false;
      Object.values(urlsRef.current).forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  const setBackground = useCallback(async (key: string, file: File) => {
    const blob = await resizeImage(file);
    await idbSet(key, blob);
    const url = URL.createObjectURL(blob);
    setUrls(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      const next = { ...prev, [key]: url };
      urlsRef.current = next;
      return next;
    });
  }, []);

  const clearBackground = useCallback(async (key: string) => {
    await idbDelete(key);
    setUrls(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]);
      const next = { ...prev };
      delete next[key];
      urlsRef.current = next;
      return next;
    });
  }, []);

  const resolve = useCallback((keys: string[]): string | null => {
    for (const k of keys) {
      if (urls[k]) return urls[k];
    }
    return null;
  }, [urls]);

  const value = useMemo<BackgroundsContextValue>(
    () => ({ urls, ready, setBackground, clearBackground, resolve }),
    [urls, ready, setBackground, clearBackground, resolve],
  );

  return (
    <BackgroundsContext.Provider value={value}>
      {children}
    </BackgroundsContext.Provider>
  );
}

export function useBackgrounds(): BackgroundsContextValue {
  const ctx = useContext(BackgroundsContext);
  if (!ctx) throw new Error('useBackgrounds deve stare dentro <BackgroundsProvider>');
  return ctx;
}
