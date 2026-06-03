import { describe, it, expect } from 'vitest';
import { parseRangeCell, repairRange } from './excelRange';

describe('parseRangeCell', () => {
  it('seriale-data Excel → range crescente', () => {
    expect(parseRangeCell(46303)).toBe('8-10'); // 8 ottobre 2026 (da "8-10")
    expect(parseRangeCell(46211)).toBe('7-8');  // 8 luglio 2026 (da "7-8")
  });
  it('stringhe normali invariate', () => {
    expect(parseRangeCell('8-10')).toBe('8-10');
    expect(parseRangeCell('12-15')).toBe('12-15');
    expect(parseRangeCell('30m/lato')).toBe('30m/lato');
  });
  it('numero piccolo resta com’è', () => {
    expect(parseRangeCell(10)).toBe('10');
  });
});

describe('repairRange', () => {
  it('ripara stringhe-seriale già salvate', () => {
    expect(repairRange('46303')).toBe('8-10');
    expect(repairRange('46211')).toBe('7-8');
  });
  it('lascia invariati i range validi', () => {
    expect(repairRange('8-10')).toBe('8-10');
    expect(repairRange('15-20')).toBe('15-20');
    expect(repairRange('10')).toBe('10');
  });
});
