import { CATEGORIES, type Category, type DailyRecord, type Reflection } from './types';
import { eachLocalDate, getYear, isWithinRange, type DateRange, type LocalDate } from './dates';

export type RecordsByDate = Map<LocalDate, Map<Category, DailyRecord>>;

export function indexRecords(records: DailyRecord[]): RecordsByDate {
  const index: RecordsByDate = new Map();
  for (const record of records) {
    let byCategory = index.get(record.localDate);
    if (!byCategory) {
      byCategory = new Map();
      index.set(record.localDate, byCategory);
    }
    byCategory.set(record.category, record);
  }
  return index;
}

export function hasText(record: DailyRecord | undefined): boolean {
  return Boolean(record && record.content.trim().length > 0);
}

/** Dimensions ticked complete on a day, in fixed display order. */
export function completedCategories(
  index: RecordsByDate,
  date: LocalDate,
): Category[] {
  const byCategory = index.get(date);
  if (!byCategory) return [];
  return CATEGORIES.filter((category) => byCategory.get(category)?.completed === true);
}

/**
 * A day "has a record" when at least one dimension is ticked complete OR has
 * non-empty text. This is deliberately broader than the completion count below.
 */
export function isRecordedDay(index: RecordsByDate, date: LocalDate): boolean {
  const byCategory = index.get(date);
  if (!byCategory) return false;
  for (const record of byCategory.values()) {
    if (record.completed || hasText(record)) return true;
  }
  return false;
}

export interface RangeStats {
  /** Days with any completion or any text. */
  recordedDays: number;
  /** Ticked completions only, per dimension. */
  completionsByCategory: Record<Category, number>;
  totalCompletions: number;
}

export function computeRangeStats(index: RecordsByDate, range: DateRange): RangeStats {
  const completionsByCategory = Object.fromEntries(
    CATEGORIES.map((category) => [category, 0]),
  ) as Record<Category, number>;
  let recordedDays = 0;
  let totalCompletions = 0;

  for (const date of eachLocalDate(range)) {
    if (isRecordedDay(index, date)) recordedDays += 1;
    const byCategory = index.get(date);
    if (!byCategory) continue;
    for (const category of CATEGORIES) {
      if (byCategory.get(category)?.completed) {
        completionsByCategory[category] += 1;
        totalCompletions += 1;
      }
    }
  }

  return { recordedDays, completionsByCategory, totalCompletions };
}

/**
 * Resolved view of a reflection: daily-sourced entries read their text from
 * the live daily record, so editing the original updates the yearly list and
 * the two can never diverge.
 */
export interface ResolvedReflection {
  id: string;
  title: string;
  content: string;
  reflectionDate: LocalDate;
  sourceType: Reflection['sourceType'];
  sourceDailyRecordId?: string;
  updatedAt: string;
  /** True when the source daily record was cleared or removed. */
  missingSource: boolean;
}

export function resolveReflection(
  reflection: Reflection,
  recordsById: Map<string, DailyRecord>,
): ResolvedReflection {
  if (reflection.sourceType === 'manual') {
    return {
      id: reflection.id,
      title: reflection.title,
      content: reflection.content,
      reflectionDate: reflection.reflectionDate,
      sourceType: 'manual',
      updatedAt: reflection.updatedAt,
      missingSource: false,
    };
  }

  const source = reflection.sourceDailyRecordId
    ? recordsById.get(reflection.sourceDailyRecordId)
    : undefined;

  return {
    id: reflection.id,
    title: reflection.title,
    content: source?.content ?? '',
    reflectionDate: source?.localDate ?? reflection.reflectionDate,
    sourceType: 'daily',
    sourceDailyRecordId: reflection.sourceDailyRecordId,
    updatedAt: source?.updatedAt ?? reflection.updatedAt,
    missingSource: !source || source.content.trim().length === 0,
  };
}

export function resolveReflections(
  reflections: Reflection[],
  records: DailyRecord[],
): ResolvedReflection[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  return reflections
    .map((reflection) => resolveReflection(reflection, recordsById))
    .sort((a, b) => b.reflectionDate.localeCompare(a.reflectionDate));
}

export function reflectionsForYear(
  reflections: ResolvedReflection[],
  year: number,
): ResolvedReflection[] {
  return reflections.filter((reflection) => getYear(reflection.reflectionDate) === year);
}

export function recordsInRange(records: DailyRecord[], range: DateRange): DailyRecord[] {
  return records.filter((record) => isWithinRange(record.localDate, range));
}

/** Latest edit timestamp across a set of records, used for review staleness. */
export function latestUpdatedAt(items: Array<{ updatedAt: string }>): string {
  return items.reduce((latest, item) => (item.updatedAt > latest ? item.updatedAt : latest), '');
}
