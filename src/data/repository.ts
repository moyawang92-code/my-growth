import type {
  BackupFile,
  Book,
  Category,
  DailyRecord,
  GrowthReview,
  Reflection,
  ReviewPeriod,
} from '../domain/types';
import type { LocalDate } from '../domain/dates';

export interface UpsertDailyRecordInput {
  localDate: LocalDate;
  category: Category;
  /** Omitted fields are left untouched, so content and completion save independently. */
  completed?: boolean;
  content?: string;
}

export interface BookInput {
  title: string;
  author?: string;
  coverUrl?: string;
  finishedDate: LocalDate;
  note?: string;
  linkedDailyRecordId?: string;
}

export interface ReflectionInput {
  title?: string;
  content: string;
  reflectionDate: LocalDate;
}

export interface ReviewInput {
  periodType: ReviewPeriod;
  periodStart: LocalDate;
  periodEnd: LocalDate;
  generatedContent: string;
  sourceUpdatedAt: string;
  engine: 'ai' | 'local';
}

/**
 * Storage contract for every entity in the product. The app only ever talks to
 * this interface, so the IndexedDB implementation can be replaced by a Supabase
 * one without touching UI code.
 */
export interface GrowthRepository {
  listDailyRecords(): Promise<DailyRecord[]>;
  upsertDailyRecord(input: UpsertDailyRecordInput): Promise<DailyRecord>;

  listBooks(): Promise<Book[]>;
  createBook(input: BookInput): Promise<Book>;
  updateBook(id: string, patch: Partial<BookInput>): Promise<Book>;
  deleteBook(id: string): Promise<void>;

  listReflections(): Promise<Reflection[]>;
  createManualReflection(input: ReflectionInput): Promise<Reflection>;
  updateManualReflection(id: string, patch: Partial<ReflectionInput>): Promise<Reflection>;
  deleteReflection(id: string): Promise<void>;
  /** Collects a daily thinking record into the yearly set, by reference. */
  collectDailyReflection(dailyRecordId: string, reflectionDate: LocalDate): Promise<Reflection>;
  /** Removes the yearly collection only; the source daily record survives. */
  removeDailyReflection(dailyRecordId: string): Promise<void>;

  listReviews(): Promise<GrowthReview[]>;
  saveReview(input: ReviewInput): Promise<GrowthReview>;

  exportBackup(): Promise<BackupFile>;
  importBackup(backup: BackupFile, mode: 'replace' | 'merge'): Promise<void>;
}
