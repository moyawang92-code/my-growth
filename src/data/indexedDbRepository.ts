import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  BackupFile,
  Book,
  DailyRecord,
  GrowthReview,
  Reflection,
} from '../domain/types';
import { CATEGORIES } from '../domain/types';
import type {
  BookInput,
  GrowthRepository,
  ReflectionInput,
  ReviewInput,
  UpsertDailyRecordInput,
} from './repository';

/**
 * Single-user local build: rows still carry a userId so the schema maps 1:1
 * onto a Supabase table with row level security later on.
 */
export const LOCAL_USER_ID = 'local-user';

const DB_NAME = 'my-growth';
const DB_VERSION = 1;

interface GrowthDb extends DBSchema {
  dailyRecords: {
    key: string;
    value: DailyRecord;
    indexes: { byDate: string; byUserDateCategory: [string, string, string] };
  };
  books: { key: string; value: Book; indexes: { byFinishedDate: string } };
  reflections: {
    key: string;
    value: Reflection;
    indexes: { bySourceDailyRecordId: string; byDate: string };
  };
  reviews: {
    key: string;
    value: GrowthReview;
    indexes: { byPeriod: [string, string, string] };
  };
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function openGrowthDb(name = DB_NAME): Promise<IDBPDatabase<GrowthDb>> {
  return openDB<GrowthDb>(name, DB_VERSION, {
    upgrade(db) {
      const daily = db.createObjectStore('dailyRecords', { keyPath: 'id' });
      daily.createIndex('byDate', 'localDate');
      // Enforces "one record per user + date + category" in the storage layer
      // itself, not just in application code.
      daily.createIndex('byUserDateCategory', ['userId', 'localDate', 'category'], {
        unique: true,
      });

      const books = db.createObjectStore('books', { keyPath: 'id' });
      books.createIndex('byFinishedDate', 'finishedDate');

      const reflections = db.createObjectStore('reflections', { keyPath: 'id' });
      // At most one yearly collection per daily thinking record.
      reflections.createIndex('bySourceDailyRecordId', 'sourceDailyRecordId', { unique: true });
      reflections.createIndex('byDate', 'reflectionDate');

      const reviews = db.createObjectStore('reviews', { keyPath: 'id' });
      reviews.createIndex('byPeriod', ['periodType', 'periodStart', 'periodEnd']);
    },
  });
}

export class IndexedDbGrowthRepository implements GrowthRepository {
  private dbPromise: Promise<IDBPDatabase<GrowthDb>>;

  private readonly userId: string;

  constructor(options: { name?: string; userId?: string } = {}) {
    this.dbPromise = openGrowthDb(options.name);
    this.userId = options.userId ?? LOCAL_USER_ID;
  }

  async listDailyRecords(): Promise<DailyRecord[]> {
    const db = await this.dbPromise;
    const all = await db.getAll('dailyRecords');
    return all.filter((record) => record.userId === this.userId);
  }

  async upsertDailyRecord(input: UpsertDailyRecordInput): Promise<DailyRecord> {
    const db = await this.dbPromise;
    const tx = db.transaction('dailyRecords', 'readwrite');
    const index = tx.store.index('byUserDateCategory');
    const existing = await index.get([this.userId, input.localDate, input.category]);
    const timestamp = nowIso();

    const record: DailyRecord = existing
      ? {
          ...existing,
          // Only the fields actually provided change, which keeps completion
          // and text independent of each other.
          completed: input.completed ?? existing.completed,
          content: input.content ?? existing.content,
          updatedAt: timestamp,
        }
      : {
          id: newId(),
          userId: this.userId,
          localDate: input.localDate,
          category: input.category,
          completed: input.completed ?? false,
          content: input.content ?? '',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    await tx.store.put(record);
    await tx.done;
    return record;
  }

  async listBooks(): Promise<Book[]> {
    const db = await this.dbPromise;
    const all = await db.getAll('books');
    return all.filter((book) => book.userId === this.userId);
  }

  async createBook(input: BookInput): Promise<Book> {
    const db = await this.dbPromise;
    const timestamp = nowIso();
    const book: Book = {
      id: newId(),
      userId: this.userId,
      title: input.title.trim(),
      author: input.author?.trim() ?? '',
      coverUrl: input.coverUrl ?? '',
      finishedDate: input.finishedDate,
      note: input.note ?? '',
      linkedDailyRecordId: input.linkedDailyRecordId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.put('books', book);
    return book;
  }

  async updateBook(id: string, patch: Partial<BookInput>): Promise<Book> {
    const db = await this.dbPromise;
    const existing = await db.get('books', id);
    if (!existing) throw new Error(`Book ${id} not found`);
    const updated: Book = {
      ...existing,
      ...patch,
      title: patch.title?.trim() ?? existing.title,
      author: patch.author?.trim() ?? existing.author,
      updatedAt: nowIso(),
    };
    await db.put('books', updated);
    return updated;
  }

  async deleteBook(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('books', id);
  }

  async listReflections(): Promise<Reflection[]> {
    const db = await this.dbPromise;
    const all = await db.getAll('reflections');
    return all.filter((reflection) => reflection.userId === this.userId);
  }

  async createManualReflection(input: ReflectionInput): Promise<Reflection> {
    const db = await this.dbPromise;
    const timestamp = nowIso();
    const reflection: Reflection = {
      id: newId(),
      userId: this.userId,
      title: input.title?.trim() ?? '',
      content: input.content,
      reflectionDate: input.reflectionDate,
      sourceType: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.put('reflections', reflection);
    return reflection;
  }

  async updateManualReflection(id: string, patch: Partial<ReflectionInput>): Promise<Reflection> {
    const db = await this.dbPromise;
    const existing = await db.get('reflections', id);
    if (!existing) throw new Error(`Reflection ${id} not found`);
    if (existing.sourceType === 'daily') {
      // Daily-sourced reflections read through to their source record; editing
      // a copy here would create the two diverging versions the spec forbids.
      throw new Error('Reflections collected from a daily record are edited on the Today page');
    }
    const updated: Reflection = {
      ...existing,
      title: patch.title?.trim() ?? existing.title,
      content: patch.content ?? existing.content,
      reflectionDate: patch.reflectionDate ?? existing.reflectionDate,
      updatedAt: nowIso(),
    };
    await db.put('reflections', updated);
    return updated;
  }

  async deleteReflection(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('reflections', id);
  }

  async collectDailyReflection(
    dailyRecordId: string,
    reflectionDate: string,
  ): Promise<Reflection> {
    const db = await this.dbPromise;
    const tx = db.transaction('reflections', 'readwrite');
    const existing = await tx.store.index('bySourceDailyRecordId').get(dailyRecordId);
    if (existing) {
      await tx.done;
      return existing;
    }
    const timestamp = nowIso();
    const reflection: Reflection = {
      id: newId(),
      userId: this.userId,
      title: '',
      content: '',
      reflectionDate,
      sourceType: 'daily',
      sourceDailyRecordId: dailyRecordId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await tx.store.put(reflection);
    await tx.done;
    return reflection;
  }

  async removeDailyReflection(dailyRecordId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('reflections', 'readwrite');
    const existing = await tx.store.index('bySourceDailyRecordId').get(dailyRecordId);
    if (existing) await tx.store.delete(existing.id);
    await tx.done;
  }

  async listReviews(): Promise<GrowthReview[]> {
    const db = await this.dbPromise;
    const all = await db.getAll('reviews');
    return all.filter((review) => review.userId === this.userId);
  }

  async saveReview(input: ReviewInput): Promise<GrowthReview> {
    const db = await this.dbPromise;
    const tx = db.transaction('reviews', 'readwrite');
    const matches = await tx.store
      .index('byPeriod')
      .getAll([input.periodType, input.periodStart, input.periodEnd]);
    const previous = matches.find((review) => review.userId === this.userId);
    const review: GrowthReview = {
      id: previous?.id ?? newId(),
      userId: this.userId,
      periodType: input.periodType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      generatedContent: input.generatedContent,
      generatedAt: nowIso(),
      sourceUpdatedAt: input.sourceUpdatedAt,
      engine: input.engine,
    };
    await tx.store.put(review);
    await tx.done;
    return review;
  }

  async exportBackup(): Promise<BackupFile> {
    const [dailyRecords, books, reflections, reviews] = await Promise.all([
      this.listDailyRecords(),
      this.listBooks(),
      this.listReflections(),
      this.listReviews(),
    ]);
    return {
      format: 'my-growth-backup',
      version: 1,
      exportedAt: nowIso(),
      dailyRecords,
      books,
      reflections,
      reviews,
    };
  }

  async importBackup(backup: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
    assertValidBackup(backup);
    const db = await this.dbPromise;
    const tx = db.transaction(['dailyRecords', 'books', 'reflections', 'reviews'], 'readwrite');

    if (mode === 'replace') {
      await Promise.all([
        tx.objectStore('dailyRecords').clear(),
        tx.objectStore('books').clear(),
        tx.objectStore('reflections').clear(),
        tx.objectStore('reviews').clear(),
      ]);
    }

    const dailyStore = tx.objectStore('dailyRecords');
    for (const record of backup.dailyRecords) {
      const owned = { ...record, userId: this.userId };
      if (mode === 'merge') {
        // Date + category is the real identity of a daily record, so a merge
        // must match on that rather than on id, and keep the newer edit.
        const clash = await dailyStore
          .index('byUserDateCategory')
          .get([this.userId, owned.localDate, owned.category]);
        if (clash) {
          if (clash.updatedAt >= owned.updatedAt) continue;
          await dailyStore.put({ ...owned, id: clash.id });
          continue;
        }
      }
      await dailyStore.put(owned);
    }

    const bookStore = tx.objectStore('books');
    for (const book of backup.books) {
      await bookStore.put({ ...book, userId: this.userId });
    }

    const reflectionStore = tx.objectStore('reflections');
    for (const reflection of backup.reflections) {
      const owned = { ...reflection, userId: this.userId };
      if (mode === 'merge' && owned.sourceDailyRecordId) {
        const clash = await reflectionStore
          .index('bySourceDailyRecordId')
          .get(owned.sourceDailyRecordId);
        if (clash) continue;
      }
      await reflectionStore.put(owned);
    }

    const reviewStore = tx.objectStore('reviews');
    for (const review of backup.reviews) {
      await reviewStore.put({ ...review, userId: this.userId });
    }

    await tx.done;
  }
}

export function assertValidBackup(value: unknown): asserts value is BackupFile {
  const backup = value as Partial<BackupFile> | null;
  if (!backup || backup.format !== 'my-growth-backup') {
    throw new Error('文件格式不正确：缺少 my-growth-backup 标识');
  }
  if (backup.version !== 1) {
    throw new Error(`不支持的备份版本：${String(backup.version)}`);
  }
  const arrays: Array<[string, unknown]> = [
    ['dailyRecords', backup.dailyRecords],
    ['books', backup.books],
    ['reflections', backup.reflections],
    ['reviews', backup.reviews],
  ];
  for (const [field, list] of arrays) {
    if (!Array.isArray(list)) throw new Error(`备份文件损坏：${field} 不是数组`);
  }
  for (const record of backup.dailyRecords as DailyRecord[]) {
    if (!CATEGORIES.includes(record.category)) {
      throw new Error(`备份文件包含未知维度：${String(record.category)}`);
    }
  }
}
