import { describe, expect, it } from 'vitest';
import type { Book, Category, DailyRecord } from './types';
import type { ResolvedReflection } from './selectors';
import { buildLocalSummary, buildReviewSource, hasEnoughData } from './reviewInput';

function record(
  localDate: string,
  category: Category,
  completed: boolean,
  content = '',
): DailyRecord {
  return {
    id: `${localDate}-${category}`,
    userId: 'local-user',
    localDate,
    category,
    completed,
    content,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function book(title: string, finishedDate: string): Book {
  return {
    id: title,
    userId: 'local-user',
    title,
    author: '',
    coverUrl: '',
    finishedDate,
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function resolved(content: string, date: string): ResolvedReflection {
  return {
    id: `${date}-r`,
    title: '',
    content,
    reflectionDate: date,
    sourceType: 'daily',
    updatedAt: '2026-01-01T00:00:00.000Z',
    missingSource: false,
  };
}

const WEEK = { start: '2026-11-01', end: '2026-11-07' };

describe('review source', () => {
  it('only includes data inside the period', () => {
    const source = buildReviewSource({
      periodType: 'weekly',
      range: WEEK,
      records: [
        record('2026-11-02', 'exercise', true, '跑步'),
        record('2026-10-20', 'exercise', true, '范围外'),
      ],
      books: [book('范围内的书', '2026-11-03'), book('范围外的书', '2026-12-01')],
      reflections: [resolved('范围内的感悟', '2026-11-04'), resolved('范围外', '2026-09-09')],
    });

    expect(source.entries).toHaveLength(1);
    expect(source.entries[0].content).toBe('跑步');
    expect(source.books.map((item) => item.title)).toEqual(['范围内的书']);
    expect(source.reflections.map((item) => item.content)).toEqual(['范围内的感悟']);
    expect(source.totalDays).toBe(7);
  });

  it('skips records that are neither ticked nor written', () => {
    const source = buildReviewSource({
      periodType: 'weekly',
      range: WEEK,
      records: [record('2026-11-02', 'eating', false, '   ')],
      books: [],
      reflections: [],
    });
    expect(source.entries).toHaveLength(0);
    expect(hasEnoughData(source)).toBe(false);
  });

  it('reports having data when only a book was finished', () => {
    const source = buildReviewSource({
      periodType: 'weekly',
      range: WEEK,
      records: [],
      books: [book('一本书', '2026-11-03')],
      reflections: [],
    });
    expect(hasEnoughData(source)).toBe(true);
  });
});

describe('local summary', () => {
  it('reproduces only what the user actually recorded', () => {
    const source = buildReviewSource({
      periodType: 'weekly',
      range: WEEK,
      records: [
        record('2026-11-02', 'exercise', true, '跑步 5 公里'),
        record('2026-11-03', 'reading', true, '读了《百年孤独》'),
        record('2026-11-04', 'thinking', false, '只写了文字没打勾'),
      ],
      books: [book('百年孤独', '2026-11-05')],
      reflections: [resolved('值得记住的想法', '2026-11-04')],
    });

    const summary = buildLocalSummary(source);

    expect(summary).toContain('跑步 5 公里');
    expect(summary).toContain('读了《百年孤独》');
    expect(summary).toContain('只写了文字没打勾');
    expect(summary).toContain('《百年孤独》');
    expect(summary).toContain('值得记住的想法');
    // Completion counts reflect ticks only.
    expect(summary).toContain('运动：完成 1 次');
    expect(summary).toContain('看书：完成 1 次');
    // The unticked thinking entry is not reported as a completion.
    expect(summary).not.toContain('今日思考：完成');
    // It must not editorialise.
    expect(summary).not.toMatch(/加油|坚持|懒|自律|失败|优秀/);
  });

  it('states plainly when nothing was ticked', () => {
    const source = buildReviewSource({
      periodType: 'monthly',
      range: { start: '2026-11-01', end: '2026-11-30' },
      records: [record('2026-11-02', 'thinking', false, '只有一条文字')],
      books: [],
      reflections: [],
    });
    const summary = buildLocalSummary(source);
    expect(summary).toContain('这段时间没有勾选完成的维度');
    expect(summary).toContain('只有一条文字');
  });

  it('counts books and reflections in the yearly summary', () => {
    const source = buildReviewSource({
      periodType: 'yearly',
      range: { start: '2026-01-01', end: '2026-12-31' },
      records: [],
      books: [book('书一', '2026-03-01'), book('书二', '2026-07-01')],
      reflections: [resolved('感悟一', '2026-05-05')],
    });
    const summary = buildLocalSummary(source);
    expect(summary).toContain('2026 年共读完 2 本书，收藏 1 条感悟');
  });
});
