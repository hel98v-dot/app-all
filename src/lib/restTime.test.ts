import { describe, it, expect } from 'vitest';
import { parseRestSeconds, timerRestSeconds, formatClock } from './restTime';

describe('parseRestSeconds', () => {
  it('minuti con apice singolo', () => {
    expect(parseRestSeconds("2'")).toBe(120);
  });
  it('range minuti: usa il primo numero', () => {
    expect(parseRestSeconds("2-3'")).toBe(120);
  });
  it('secondi con doppio apice', () => {
    expect(parseRestSeconds('90"')).toBe(90);
    expect(parseRestSeconds('45"')).toBe(45);
  });
  it('default 90s su input non valido', () => {
    expect(parseRestSeconds(undefined)).toBe(90);
    expect(parseRestSeconds('')).toBe(90);
    expect(parseRestSeconds('boh')).toBe(90);
  });
});

describe('timerRestSeconds', () => {
  it('sottrae 10s di preparazione', () => {
    expect(timerRestSeconds("2-3'")).toBe(110);
    expect(timerRestSeconds('90"')).toBe(80);
    expect(timerRestSeconds('45"')).toBe(35);
  });
  it('mantiene un minimo di 10s', () => {
    expect(timerRestSeconds('15"')).toBe(10);
    expect(timerRestSeconds('5"')).toBe(10);
  });
});

describe('formatClock', () => {
  it('formatta in M:SS', () => {
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(9)).toBe('0:09');
  });
});
