import { describe, expect, it } from 'vitest';
import type { Category, DailyRecord, Reflection } from './types';
import {
  completedCategories,
  computeRangeStats,
  indexRecords,
  isRecordedDay,
  latestUpdatedAt,
  resolveReflections,
} from './selectors';

function record(
  localDate: string,
  category: Category,
  completed: boolean,
  content = '',
  id = `${localDate}-${category}`,
): DailyRecord {
  return {
    id,
    userId: 'local-user',
    localDate,
    category,
    completed,
    content,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('daily record stats', () => {
  it('lists completed dimensions in the fixed display order', () => {
    const index = indexRecords([
      record('2026-11-02', 'thinking', true),
      record('2026-11-02', 'exercise', true),
      record('2026-11-02', 'eating', false, '随便吃了点'),
    ]);
    expect(completedCategories(index, '2026-11-02')).toEqual(['exercise', 'thinking']);
  });

  it('counts a day as recorded when there is text but no tick', () => {
    const index = indexRecords([record('2026-11-02', 'thinking', false, '想到一件事')]);
    expect(isRecordedDay(index, '2026-11-02')).toBe(true);
    expect(completedCategories(index, '2026-11-02')).toEqual([]);
  });

  it('counts a day as recorded when there is a tick but no text', () => {
    const index = indexRecords([record('2026-11-02', 'exercise', true, '')]);
    expect(isRecordedDay(index, '2026-11-02')).toBe(true);
  });

  it('ignores whitespace-only text for the recorded-day test', () => {
    const index = indexRecords([record('2026-11-02', 'eating', false, '   \n  ')]);
    expect(isRecordedDay(index, '2026-11-02')).toBe(false);
  });

  it('treats an empty day as not recorded', () => {
    const index = indexRecords([]);
    expect(isRecordedDay(index, '2026-11-02')).toBe(false);
    expect(completedCategories(index, '2026-11-02')).toEqual([]);
  });

  it('separates "recorded days" from "completion count"', () => {
    const index = indexRecords([
      // Day 1: two ticks.
      record('2026-11-02', 'exercise', true),
      record('2026-11-02', 'reading', true),
      // Day 2: text only, no tick.
      record('2026-11-03', 'thinking', false, '只写了文字'),
      // Day 3: nothing at all (not stored).
    ]);
    const stats = computeRangeStats(index, { start: '2026-11-01', end: '2026-11-07' });

    // Three dimensions have content, but only two are ticked.
    expect(stats.totalCompletions).toBe(2);
    // Two days have something, even though one of them has no tick.
    expect(stats.recordedDays).toBe(2);
    expect(stats.completionsByCategory.exercise).toBe(1);
    expect(stats.completionsByCategory.thinking).toBe(0);
  });

  it('counts completions only inside the requested range', () => {
    const index = indexRecords([
      record('2026-10-31', 'exercise', true),
      record('2026-11-02', 'exercise', true),
    ]);
    const stats = computeRangeStats(index, { start: '2026-11-01', end: '2026-11-30' });
    expect(stats.completionsByCategory.exercise).toBe(1);
  });
});

function reflection(overrides: Partial<Reflection>): Reflection {
  return {
    id: 'r1',
    userId: 'local-user',
    title: '',
    content: '',
    reflectionDate: '2026-11-02',
    sourceType: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('reflection resolution', () => {
  it('reads daily-sourced text from the live daily record', () => {
    const daily = record('2026-11-02', 'thinking', false, '原始想法', 'daily-1');
    const resolved = resolveReflections(
      [reflection({ sourceType: 'daily', sourceDailyRecordId: 'daily-1' })],
      [daily],
    );
    expect(resolved[0].content).toBe('原始想法');
    expect(resolved[0].sourceType).toBe('daily');
  });

  it('reflects an edit of the original thinking record without a second copy', () => {
    const collected = reflection({ sourceType: 'daily', sourceDailyRecordId: 'daily-1' });
    const before = resolveReflections(
      [collected],
      [record('2026-11-02', 'thinking', false, '第一版', 'daily-1')],
    );
    const after = resolveReflections(
      [collected],
      [record('2026-11-02', 'thinking', false, '修改后的版本', 'daily-1')],
    );
    expect(before[0].content).toBe('第一版');
    expect(after[0].content).toBe('修改后的版本');
    // The stored reflection itself never carries a duplicate of the text.
    expect(collected.content).toBe('');
  });

  it('flags a daily reflection whose source text was cleared', () => {
    const resolved = resolveReflections(
      [reflection({ sourceType: 'daily', sourceDailyRecordId: 'daily-1' })],
      [record('2026-11-02', 'thinking', false, '', 'daily-1')],
    );
    expect(resolved[0].missingSource).toBe(true);
  });

  it('keeps manual reflection text as stored', () => {
    const resolved = resolveReflections(
      [reflection({ content: '独立新增的感悟', title: '标题' })],
      [],
    );
    expect(resolved[0].content).toBe('独立新增的感悟');
    expect(resolved[0].title).toBe('标题');
    expect(resolved[0].missingSource).toBe(false);
  });

  it('sorts reflections newest first', () => {
    const resolved = resolveReflections(
      [
        reflection({ id: 'a', content: '早', reflectionDate: '2026-01-05' }),
        reflection({ id: 'b', content: '晚', reflectionDate: '2026-11-02' }),
      ],
      [],
    );
    expect(resolved.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('latestUpdatedAt', () => {
  it('returns the newest timestamp for review staleness checks', () => {
    expect(
      latestUpdatedAt([
        { updatedAt: '2026-11-01T10:00:00.000Z' },
        { updatedAt: '2026-11-03T08:00:00.000Z' },
        { updatedAt: '2026-11-02T23:00:00.000Z' },
      ]),
    ).toBe('2026-11-03T08:00:00.000Z');
  });

  it('returns an empty string for no data', () => {
    expect(latestUpdatedAt([])).toBe('');
  });
});
