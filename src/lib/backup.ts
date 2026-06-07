// src/lib/backup.ts
// Backup/restore COMPLETO dello stato di un profilo.
// Un backup contiene log + schede + superset + sostituzioni, così il ripristino
// è senza perdite (prima l'export salvava solo i log: ripristinando, la scheda
// e quindi la visibilità dei dati andavano perse).
//
// L'import accetta DUE formati:
//   • bundle nuovo  → { version, log, schedules, supersets, swaps }
//   • legacy log    → { startDate, sessions }   (vecchi export / dati su Gist)

import { logKey } from '../hooks/useProfileStore';

const BACKUP_VERSION = 2;

// ── Chiavi per-profilo ────────────────────────────────────────────────────────

export function activeProfileId(): string {
  try {
    const raw = localStorage.getItem('profiles-v1');
    if (raw) {
      const s = JSON.parse(raw) as { activeId?: string };
      if (s.activeId) return s.activeId;
    }
  } catch { /* ignore */ }
  return 'default';
}

const schedulesKey = (pid: string) => `schedules-v1-${pid}`;
const supersetsKey = (pid: string) => `training-supersets-v1-${pid}`;
const swapsKey     = (pid: string) => `training-swaps-v1-${pid}`;

// ── Tipi ──────────────────────────────────────────────────────────────────────

export interface AppBackup {
  version:    number;
  exportedAt: string;
  profileId:  string;
  log:        unknown;   // LogStore
  schedules:  unknown;   // SchedulesStore
  supersets:  unknown;   // PairMap
  swaps:      unknown;   // SwapMap
}

function readKey(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Export ──────────────────────────────────────────────────────────────────

export function buildBackup(): AppBackup {
  const pid = activeProfileId();
  return {
    version:    BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profileId:  pid,
    log:        readKey(logKey(pid)),
    schedules:  readKey(schedulesKey(pid)),
    supersets:  readKey(supersetsKey(pid)),
    swaps:      readKey(swapsKey(pid)),
  };
}

export function serializeBackup(): string {
  return JSON.stringify(buildBackup(), null, 2);
}

// ── Riconoscimento formato ────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function isBackupBundle(v: unknown): boolean {
  return isObject(v) && typeof v.version === 'number' && 'log' in v;
}

export function isLegacyLog(v: unknown): boolean {
  return isObject(v) && typeof v.startDate === 'string' && Array.isArray(v.sessions);
}

// ── Import ────────────────────────────────────────────────────────────────────

export type ImportMode = 'bundle' | 'legacy' | 'invalid';

/**
 * Applica un JSON di backup al PROFILO ATTIVO (sovrascrive).
 * Scrive direttamente in localStorage; il chiamante deve ricaricare la pagina
 * per re-inizializzare gli hook React.
 */
export function applyBackup(jsonString: string): ImportMode {
  let parsed: unknown;
  try { parsed = JSON.parse(jsonString); } catch { return 'invalid'; }

  const pid = activeProfileId();

  if (isBackupBundle(parsed)) {
    const b = parsed as Partial<AppBackup>;
    // Scrive solo le sezioni presenti (un campo mancante non azzera l'esistente)
    if (b.log       != null) localStorage.setItem(logKey(pid),       JSON.stringify(b.log));
    if (b.schedules != null) localStorage.setItem(schedulesKey(pid), JSON.stringify(b.schedules));
    if (b.supersets != null) localStorage.setItem(supersetsKey(pid), JSON.stringify(b.supersets));
    if (b.swaps     != null) localStorage.setItem(swapsKey(pid),     JSON.stringify(b.swaps));
    return 'bundle';
  }

  if (isLegacyLog(parsed)) {
    // Vecchio formato: solo i log. Le schede esistenti restano invariate.
    localStorage.setItem(logKey(pid), JSON.stringify(parsed));
    return 'legacy';
  }

  return 'invalid';
}
