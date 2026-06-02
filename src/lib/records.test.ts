import { describe, it, expect } from 'vitest';
import {
  estimate1RM, setVolume, bestOfSets,
  exerciseHistory, recordsFromHistory, lastPerformance,
} from './records';
import type { SessionLog } from '../types';

describe('estimate1RM (Epley)', () => {
  it('reps = 1 ritorna il carico', () => expect(estimate1RM(100, 1)).toBe(100));
  it('reps multiple', () => expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1));
  it('corpo libero o reps 0 → 0', () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(50, 0)).toBe(0);
  });
});

describe('setVolume', () => {
  it('reps × kg', () => expect(setVolume({ reps: 8, kg: 20 })).toBe(160));
});

describe('bestOfSets', () => {
  it('estrae carico/1RM/volume migliori', () => {
    const r = bestOfSets([{ reps: 8, kg: 20 }, { reps: 5, kg: 30 }, { reps: 12, kg: 10 }]);
    expect(r.topKg).toBe(30);
    expect(r.volume).toBe(160 + 150 + 120);
    expect(r.topE1rm).toBeCloseTo(estimate1RM(30, 5), 5);
  });
});

const sessions: SessionLog[] = [
  { id: 'a', weekNumber: 1, sessionId: 'lun', date: '2026-01-01', exercises: [
    { exerciseId: 'lun-1', sets: [{ reps: 8, kg: 20 }, { reps: 8, kg: 22.5 }], completedAt: '' },
  ] },
  { id: 'b', weekNumber: 2, sessionId: 'lun', date: '2026-01-08', exercises: [
    { exerciseId: 'lun-1', sets: [{ reps: 8, kg: 25 }], completedAt: '' },
  ] },
  { id: 'c', weekNumber: 3, sessionId: 'lun', date: '2026-01-15', exercises: [
    { exerciseId: 'lun-1', sets: [{ reps: 0, kg: 0 }], completedAt: '' }, // niente volume
  ] },
];

describe('exerciseHistory', () => {
  it('ordina per data ed esclude sessioni senza volume', () => {
    const h = exerciseHistory(sessions, 'lun-1');
    expect(h.map(e => e.date)).toEqual(['2026-01-01', '2026-01-08']);
    expect(h[0]?.topKg).toBe(22.5);
  });
  it('esclude la sessione corrente', () => {
    const h = exerciseHistory(sessions, 'lun-1', { weekNumber: 2, sessionId: 'lun', date: '2026-01-08' });
    expect(h.map(e => e.date)).toEqual(['2026-01-01']);
  });
});

describe('recordsFromHistory', () => {
  it('calcola i massimi e il conteggio', () => {
    const recs = recordsFromHistory(exerciseHistory(sessions, 'lun-1'));
    expect(recs.maxKg).toBe(25);
    expect(recs.sessions).toBe(2);
    expect(recs.maxE1rm).toBeCloseTo(estimate1RM(25, 8), 5);
  });
});

describe('lastPerformance', () => {
  it('ritorna la prestazione più recente', () => {
    const last = lastPerformance(sessions, 'lun-1');
    expect(last?.date).toBe('2026-01-08');
    expect(last?.sets).toEqual([{ reps: 8, kg: 25 }]);
  });
  it('esclude la sessione corrente', () => {
    const last = lastPerformance(sessions, 'lun-1', { weekNumber: 2, sessionId: 'lun', date: '2026-01-08' });
    expect(last?.date).toBe('2026-01-01');
  });
});
