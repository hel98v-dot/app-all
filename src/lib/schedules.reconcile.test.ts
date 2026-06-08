// src/lib/schedules.reconcile.test.ts
// Verifica la riconciliazione dati: i log "orfani" non devono mai restare
// invisibili, e l'utente deve atterrare sulla scheda che possiede i suoi dati.

import { beforeEach, describe, expect, it } from 'vitest';
import { reconcileActiveProfile } from './schedules';

// ── Mock localStorage / sessionStorage ────────────────────────────────────────
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  get length(): number { return this.m.size; }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage = new MemStorage();
  // Profilo attivo = 'default' → chiave log 'training-log-v1'
  localStorage.setItem('profiles-v1', JSON.stringify({ activeId: 'default', profiles: [] }));
});

const LOG_KEY = 'training-log-v1';
const SCHED_KEY = 'schedules-v1-default';

function setLog(sessions: unknown[]): void {
  localStorage.setItem(LOG_KEY, JSON.stringify({ startDate: '2026-05-31', sessions }));
}
function getLog(): { sessions: Array<{ scheduleId?: string }> } {
  return JSON.parse(localStorage.getItem(LOG_KEY)!) as { sessions: Array<{ scheduleId?: string }> };
}
function setSchedules(activeId: string, list: Array<{ id: string; name: string }>): void {
  localStorage.setItem(SCHED_KEY, JSON.stringify({
    activeId,
    list: list.map(s => ({ ...s, sessions: [] })),
  }));
}
function getActive(): string {
  return JSON.parse(localStorage.getItem(SCHED_KEY)!).activeId as string;
}

const sessionWith = (scheduleId: string) => ({
  id: crypto.randomUUID(),
  weekNumber: 1,
  sessionId: 'gio',
  date: '2026-06-02',
  scheduleId,
  exercises: [{ exerciseId: 'gio-0', sets: [{ reps: 10, kg: 20 }], completedAt: '2026-06-02T10:00:00Z' }],
});

describe('reconcileActiveProfile', () => {
  it('A) ri-tagga i log orfani sulla singola scheda custom e ci atterra', () => {
    setSchedules('default', [{ id: 'sched-1', name: 'Mia scheda' }]);
    setLog([sessionWith('orphan-xyz')]); // scheduleId inesistente

    reconcileActiveProfile();

    expect(getLog().sessions[0].scheduleId).toBe('sched-1'); // orfano adottato
    expect(getActive()).toBe('sched-1');                     // attiva la scheda con i dati
  });

  it('B) se i log sono su una scheda valida ma l\'attiva è vuota, attiva quella giusta', () => {
    setSchedules('default', [{ id: 'sched-1', name: 'Mia scheda' }]);
    setLog([sessionWith('sched-1')]);

    reconcileActiveProfile();

    expect(getLog().sessions[0].scheduleId).toBe('sched-1'); // invariato
    expect(getActive()).toBe('sched-1');                     // heal verso i dati
  });

  it('C) NON sposta l\'utente se ha appena scelto una scheda (flag skip-heal)', () => {
    setSchedules('sched-2', [{ id: 'sched-1', name: 'Vecchia' }, { id: 'sched-2', name: 'Nuova' }]);
    setLog([sessionWith('sched-1')]);          // i dati sono su sched-1
    sessionStorage.setItem('arise-skip-heal', '1');

    reconcileActiveProfile();

    expect(getActive()).toBe('sched-2');       // resta dove l'utente l'ha messa
  });

  it('D) senza schede custom, i log orfani finiscono su default e restano visibili', () => {
    setSchedules('default', []);               // nessuna scheda custom
    setLog([sessionWith('sched-1')]);          // orfano (nessuna definizione)

    reconcileActiveProfile();

    expect(getLog().sessions[0].scheduleId).toBe('default');
    expect(getActive()).toBe('default');
  });

  it('E) idempotente: una seconda esecuzione non cambia nulla', () => {
    setSchedules('default', [{ id: 'sched-1', name: 'Mia' }]);
    setLog([sessionWith('orphan-1')]);

    reconcileActiveProfile();
    const after1 = localStorage.getItem(LOG_KEY);
    const active1 = getActive();
    sessionStorage.removeItem('arise-skip-heal'); // non era settato comunque
    reconcileActiveProfile();

    expect(localStorage.getItem(LOG_KEY)).toBe(after1);
    expect(getActive()).toBe(active1);
  });
});
