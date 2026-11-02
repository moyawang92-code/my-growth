import { describe, expect, it } from 'vitest';
import {
  dayOfMonth,
  eachLocalDate,
  formatWeekday,
  getYear,
  isFutureLocalDate,
  monthGrid,
  monthRange,
  parseLocalDate,
  shiftLocalDate,
  shiftLocalMonth,
  todayLocalDate,
  toLocalDate,
  weekRange,
  yearRange,
} from './dates';

describe('local date handling', () => {
  it('parses YYYY-MM-DD at local midnight, not UTC', () => {
    const date = parseLocalDate('2026-03-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });

  it('round-trips a date through format and parse', () => {
    expect(toLocalDate(parseLocalDate('2026-12-31'))).toBe('2026-12-31');
  });

  it('keeps the calendar day for a late-evening timestamp', () => {
    // 23:50 local would roll over to the next day if converted through UTC
    // in a positive-offset timezone.
    const lateEvening = new Date(2026, 10, 2, 23, 50, 0);
    expect(todayLocalDate(lateEvening)).toBe('2026-11-02');
  });

  it('shifts across month and year boundaries', () => {
    expect(shiftLocalDate('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftLocalDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftLocalMonth('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('handles February in common and leap years', () => {
    expect(monthRange('2026-02-10').end).toBe('2026-02-28');
    expect(monthRange('2024-02-10').end).toBe('2024-02-29');
    expect(eachLocalDate(monthRange('2024-02-01'))).toHaveLength(29);
    expect(eachLocalDate(monthRange('2026-02-01'))).toHaveLength(28);
  });

  it('builds a 42-cell grid that starts on a Sunday', () => {
    const grid = monthGrid('2026-02-01');
    expect(grid).toHaveLength(42);
    expect(parseLocalDate(grid[0]).getDay()).toBe(0);
    expect(grid).toContain('2026-02-01');
    expect(grid).toContain('2026-02-28');
  });

  it('aligns a month that begins on a Sunday without a blank leading week', () => {
    // 2026-03-01 is a Sunday.
    const grid = monthGrid('2026-03-01');
    expect(grid[0]).toBe('2026-03-01');
    expect(formatWeekday('2026-03-01')).toBe('周日');
  });

  it('pads a month that begins on a Saturday', () => {
    // 2026-08-01 is a Saturday, so six days of July lead the grid.
    const grid = monthGrid('2026-08-01');
    expect(grid[0]).toBe('2026-07-26');
    expect(grid[6]).toBe('2026-08-01');
  });

  it('derives week ranges from Sunday to Saturday', () => {
    const range = weekRange('2026-11-02'); // Monday
    expect(range.start).toBe('2026-11-01');
    expect(range.end).toBe('2026-11-07');
  });

  it('computes year ranges and year membership', () => {
    expect(yearRange(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(getYear('2025-12-31')).toBe(2025);
  });

  it('recognises future dates against a fixed now', () => {
    const now = new Date(2026, 10, 2, 9, 0, 0);
    expect(isFutureLocalDate('2026-11-03', now)).toBe(true);
    expect(isFutureLocalDate('2026-11-02', now)).toBe(false);
    expect(isFutureLocalDate('2026-11-01', now)).toBe(false);
  });

  it('reads the day of month from a local date', () => {
    expect(dayOfMonth('2026-11-09')).toBe(9);
  });
});
