/**
 * Core domain types.
 *
 * `localDate` / `finishedDate` / `reflectionDate` are always plain calendar
 * dates in `YYYY-MM-DD`, interpreted in the user's local timezone. They are
 * never stored as timestamps, so a record written at 23:50 local time cannot
 * drift into the next day via UTC conversion.
 */

export const CATEGORIES = [
  'exercise',
  'reading',
  'eating',
  'deepTalk',
  'english',
  'thinking',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface DailyRecord {
  id: string;
  userId: string;
  localDate: string;
  category: Category;
  completed: boolean;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  /** Data URL for a user-uploaded cover, or empty when a placeholder is used. */
  coverUrl: string;
  finishedDate: string;
  note: string;
  linkedDailyRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReflectionSource = 'daily' | 'manual';

export interface Reflection {
  id: string;
  userId: string;
  title: string;
  /**
   * Only meaningful for `sourceType: 'manual'`. Reflections collected from a
   * daily "thinking" record keep `content: ''` and read through to the source
   * record instead, so editing the original cannot leave two diverging copies.
   */
  content: string;
  reflectionDate: string;
  sourceType: ReflectionSource;
  sourceDailyRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewPeriod = 'weekly' | 'monthly' | 'yearly';

export interface GrowthReview {
  id: string;
  userId: string;
  periodType: ReviewPeriod;
  periodStart: string;
  periodEnd: string;
  generatedContent: string;
  generatedAt: string;
  /** Max `updatedAt` across the source data at generation time. */
  sourceUpdatedAt: string;
  /** Which engine produced the text, so the UI never implies AI wrote a local summary. */
  engine: 'ai' | 'local';
}

export interface BackupFile {
  format: 'my-growth-backup';
  version: 1;
  exportedAt: string;
  dailyRecords: DailyRecord[];
  books: Book[];
  reflections: Reflection[];
  reviews: GrowthReview[];
}
