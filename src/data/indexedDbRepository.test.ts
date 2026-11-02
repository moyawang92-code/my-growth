import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbGrowthRepository, assertValidBackup } from './indexedDbRepository';
import type { BackupFile } from '../domain/types';

let counter = 0;

function freshRepo(): IndexedDbGrowthRepository {
  counter += 1;
  return new IndexedDbGrowthRepository({ name: `test-db-${counter}-${Date.now()}` });
}

let repo: IndexedDbGrowthRepository;

beforeEach(() => {
  repo = freshRepo();
});

describe('daily record upsert', () => {
  it('keeps one record per date and category', async () => {
    await repo.upsertDailyRecord({ localDate: '2026-11-02', category: 'exercise', content: '跑步' });
    await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'exercise',
      content: '跑步 5 公里',
    });
    const all = await repo.listDailyRecords();
    expect(all).toHaveLength(1);
    expect(all[0].content).toBe('跑步 5 公里');
  });

  it('stores completion and text independently', async () => {
    // Text only: completion must stay false.
    const written = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      content: '只写文字，不打勾',
    });
    expect(written.completed).toBe(false);

    // Tick only: text must survive untouched.
    const ticked = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      completed: true,
    });
    expect(ticked.completed).toBe(true);
    expect(ticked.content).toBe('只写文字，不打勾');

    // Unticking must not clear the text.
    const unticked = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      completed: false,
    });
    expect(unticked.completed).toBe(false);
    expect(unticked.content).toBe('只写文字，不打勾');
  });

  it('keeps different dates and categories apart', async () => {
    await repo.upsertDailyRecord({ localDate: '2026-11-01', category: 'reading', content: '昨天' });
    await repo.upsertDailyRecord({ localDate: '2026-11-02', category: 'reading', content: '今天' });
    await repo.upsertDailyRecord({ localDate: '2026-11-02', category: 'english', content: '英语' });
    const all = await repo.listDailyRecords();
    expect(all).toHaveLength(3);
    expect(all.filter((item) => item.localDate === '2026-11-02')).toHaveLength(2);
  });

  it('allows editing a record from months earlier', async () => {
    await repo.upsertDailyRecord({ localDate: '2026-08-05', category: 'eating', completed: true });
    await repo.upsertDailyRecord({
      localDate: '2026-08-05',
      category: 'eating',
      content: '三个月前补写的记录',
    });
    const all = await repo.listDailyRecords();
    expect(all).toHaveLength(1);
    expect(all[0].completed).toBe(true);
    expect(all[0].content).toBe('三个月前补写的记录');
  });
});

describe('books', () => {
  it('creates a book from a title alone', async () => {
    const book = await repo.createBook({ title: '  被讨厌的勇气  ', finishedDate: '2026-11-02' });
    expect(book.title).toBe('被讨厌的勇气');
    expect(book.author).toBe('');
    expect(book.coverUrl).toBe('');
  });

  it('buckets books by finished date, not creation time', async () => {
    await repo.createBook({ title: '去年读完的', finishedDate: '2025-12-20' });
    await repo.createBook({ title: '今年读完的', finishedDate: '2026-01-04' });
    const books = await repo.listBooks();
    const years = books.map((book) => book.finishedDate.slice(0, 4)).sort();
    expect(years).toEqual(['2025', '2026']);
  });

  it('updates and deletes a book', async () => {
    const book = await repo.createBook({ title: '原书名', finishedDate: '2026-11-02' });
    const updated = await repo.updateBook(book.id, { title: '新书名', author: '某作者' });
    expect(updated.title).toBe('新书名');
    expect(updated.author).toBe('某作者');
    await repo.deleteBook(book.id);
    expect(await repo.listBooks()).toHaveLength(0);
  });
});

describe('reflections', () => {
  it('collects a daily thinking record by reference, without copying text', async () => {
    const daily = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      content: '一个想法',
    });
    const collected = await repo.collectDailyReflection(daily.id, '2026-11-02');
    expect(collected.sourceType).toBe('daily');
    expect(collected.sourceDailyRecordId).toBe(daily.id);
    expect(collected.content).toBe('');
  });

  it('collects at most one reflection per daily record', async () => {
    const daily = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      content: '一个想法',
    });
    const first = await repo.collectDailyReflection(daily.id, '2026-11-02');
    const second = await repo.collectDailyReflection(daily.id, '2026-11-02');
    expect(second.id).toBe(first.id);
    expect(await repo.listReflections()).toHaveLength(1);
  });

  it('uncollecting removes the reflection but keeps the daily record', async () => {
    const daily = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      content: '要保留的原始思考',
    });
    await repo.collectDailyReflection(daily.id, '2026-11-02');
    await repo.removeDailyReflection(daily.id);

    expect(await repo.listReflections()).toHaveLength(0);
    const records = await repo.listDailyRecords();
    expect(records).toHaveLength(1);
    expect(records[0].content).toBe('要保留的原始思考');
  });

  it('refuses to edit a daily-sourced reflection as if it were manual', async () => {
    const daily = await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'thinking',
      content: '想法',
    });
    const collected = await repo.collectDailyReflection(daily.id, '2026-11-02');
    await expect(
      repo.updateManualReflection(collected.id, { content: '改写' }),
    ).rejects.toThrow();
  });

  it('creates, edits and deletes a manual reflection', async () => {
    const created = await repo.createManualReflection({
      content: '独立感悟',
      reflectionDate: '2026-11-02',
    });
    expect(created.sourceType).toBe('manual');
    const edited = await repo.updateManualReflection(created.id, { title: '标题' });
    expect(edited.title).toBe('标题');
    expect(edited.content).toBe('独立感悟');
    await repo.deleteReflection(created.id);
    expect(await repo.listReflections()).toHaveLength(0);
  });
});

describe('reviews', () => {
  it('replaces the saved review for the same period instead of duplicating', async () => {
    const base = {
      periodType: 'weekly' as const,
      periodStart: '2026-11-01',
      periodEnd: '2026-11-07',
      sourceUpdatedAt: '2026-11-02T10:00:00.000Z',
      engine: 'local' as const,
    };
    const first = await repo.saveReview({ ...base, generatedContent: '第一版' });
    const second = await repo.saveReview({ ...base, generatedContent: '第二版' });
    expect(second.id).toBe(first.id);
    const all = await repo.listReviews();
    expect(all).toHaveLength(1);
    expect(all[0].generatedContent).toBe('第二版');
  });
});

describe('backup', () => {
  it('round-trips an export through a replace import', async () => {
    await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'exercise',
      completed: true,
      content: '跑步',
    });
    await repo.createBook({ title: '一本书', finishedDate: '2026-11-02' });
    const backup = await repo.exportBackup();

    const target = freshRepo();
    await target.importBackup(backup, 'replace');
    expect(await target.listDailyRecords()).toHaveLength(1);
    expect(await target.listBooks()).toHaveLength(1);
  });

  it('keeps the newer edit when merging the same date and category', async () => {
    await repo.upsertDailyRecord({
      localDate: '2026-11-02',
      category: 'exercise',
      content: '设备上的较新记录',
    });
    const current = await repo.listDailyRecords();

    const staleBackup: BackupFile = {
      format: 'my-growth-backup',
      version: 1,
      exportedAt: '2026-11-01T00:00:00.000Z',
      dailyRecords: [
        {
          ...current[0],
          id: 'different-id',
          content: '备份里的较旧记录',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      books: [],
      reflections: [],
      reviews: [],
    };

    await repo.importBackup(staleBackup, 'merge');
    const merged = await repo.listDailyRecords();
    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe('设备上的较新记录');
  });

  it('rejects a file that is not a My Growth backup', () => {
    expect(() => assertValidBackup({ foo: 'bar' })).toThrow();
    expect(() =>
      assertValidBackup({ format: 'my-growth-backup', version: 99, dailyRecords: [] }),
    ).toThrow();
  });

  it('rejects a backup containing an unknown dimension', () => {
    expect(() =>
      assertValidBackup({
        format: 'my-growth-backup',
        version: 1,
        exportedAt: '2026-11-02T00:00:00.000Z',
        dailyRecords: [{ category: 'meditation' }],
        books: [],
        reflections: [],
        reviews: [],
      }),
    ).toThrow(/未知维度/);
  });
});
