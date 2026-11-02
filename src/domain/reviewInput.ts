import { CATEGORY_META } from './categories';
import { CATEGORIES, type Book, type Category, type DailyRecord, type ReviewPeriod } from './types';
import { formatLongDate, getYear, isWithinRange, type DateRange } from './dates';
import {
  computeRangeStats,
  indexRecords,
  hasText,
  type ResolvedReflection,
} from './selectors';

/**
 * The factual payload a review is built from. Both the local summary and the
 * AI prompt consume exactly this, so a review can only ever reference records
 * the user actually wrote.
 */
export interface ReviewSourceData {
  periodType: ReviewPeriod;
  range: DateRange;
  recordedDays: number;
  totalDays: number;
  completionsByCategory: Record<Category, number>;
  entries: Array<{ date: string; category: Category; completed: boolean; content: string }>;
  books: Array<{ title: string; author: string; finishedDate: string; note: string }>;
  reflections: Array<{ date: string; title: string; content: string }>;
}

export function buildReviewSource(params: {
  periodType: ReviewPeriod;
  range: DateRange;
  records: DailyRecord[];
  books: Book[];
  reflections: ResolvedReflection[];
}): ReviewSourceData {
  const { periodType, range, records, books, reflections } = params;
  const inRange = records.filter((record) => isWithinRange(record.localDate, range));
  const index = indexRecords(inRange);
  const stats = computeRangeStats(index, range);

  const totalDays =
    (Date.parse(`${range.end}T00:00:00`) - Date.parse(`${range.start}T00:00:00`)) / 86_400_000 + 1;

  return {
    periodType,
    range,
    recordedDays: stats.recordedDays,
    totalDays,
    completionsByCategory: stats.completionsByCategory,
    entries: inRange
      .filter((record) => record.completed || hasText(record))
      .sort((a, b) => a.localDate.localeCompare(b.localDate))
      .map((record) => ({
        date: record.localDate,
        category: record.category,
        completed: record.completed,
        content: record.content.trim(),
      })),
    books: books
      .filter((book) => isWithinRange(book.finishedDate, range))
      .sort((a, b) => a.finishedDate.localeCompare(b.finishedDate))
      .map((book) => ({
        title: book.title,
        author: book.author,
        finishedDate: book.finishedDate,
        note: book.note.trim(),
      })),
    reflections: reflections
      .filter(
        (reflection) =>
          isWithinRange(reflection.reflectionDate, range) && reflection.content.trim().length > 0,
      )
      .sort((a, b) => a.reflectionDate.localeCompare(b.reflectionDate))
      .map((reflection) => ({
        date: reflection.reflectionDate,
        title: reflection.title,
        content: reflection.content.trim(),
      })),
  };
}

export function hasEnoughData(source: ReviewSourceData): boolean {
  return source.entries.length > 0 || source.books.length > 0 || source.reflections.length > 0;
}

const PERIOD_LABEL: Record<ReviewPeriod, string> = {
  weekly: '本周',
  monthly: '本月',
  yearly: '这一年',
};

/**
 * Deterministic, offline summary of the period. It only reorganises records the
 * user wrote: no interpretation, no encouragement, no invented facts.
 */
export function buildLocalSummary(source: ReviewSourceData): string {
  const label = PERIOD_LABEL[source.periodType];
  const lines: string[] = [];

  lines.push(`## ${label}回顾（本地摘要）`);
  lines.push('');
  lines.push(
    `时间范围：${formatLongDate(source.range.start)} — ${formatLongDate(source.range.end)}`,
  );
  lines.push(`有记录的天数：${source.recordedDays} / ${source.totalDays} 天`);
  lines.push('');

  lines.push('### 六个维度');
  lines.push('');
  const activeCategories = CATEGORIES.filter(
    (category) => source.completionsByCategory[category] > 0,
  );
  if (activeCategories.length === 0) {
    lines.push('这段时间没有勾选完成的维度。');
  } else {
    for (const category of activeCategories) {
      lines.push(`- ${CATEGORY_META[category].label}：完成 ${source.completionsByCategory[category]} 次`);
    }
    const untouched = CATEGORIES.filter((category) => source.completionsByCategory[category] === 0);
    if (untouched.length > 0) {
      lines.push('');
      lines.push(
        `未勾选完成的维度：${untouched.map((category) => CATEGORY_META[category].label).join('、')}。`,
      );
    }
  }

  const textEntries = source.entries.filter((entry) => entry.content.length > 0);
  if (textEntries.length > 0) {
    lines.push('');
    lines.push('### 留下的文字记录');
    lines.push('');
    for (const category of CATEGORIES) {
      const byCategory = textEntries.filter((entry) => entry.category === category);
      if (byCategory.length === 0) continue;
      lines.push(`**${CATEGORY_META[category].label}**`);
      lines.push('');
      for (const entry of byCategory) {
        lines.push(`- ${entry.date}：${entry.content}`);
      }
      lines.push('');
    }
  }

  if (source.books.length > 0) {
    lines.push('### 读完的书');
    lines.push('');
    for (const book of source.books) {
      const author = book.author ? `（${book.author}）` : '';
      const note = book.note ? ` — ${book.note}` : '';
      lines.push(`- 《${book.title}》${author} 读完于 ${book.finishedDate}${note}`);
    }
    lines.push('');
  }

  if (source.reflections.length > 0) {
    lines.push('### 收藏的感悟');
    lines.push('');
    for (const reflection of source.reflections) {
      const title = reflection.title ? `**${reflection.title}** ` : '';
      lines.push(`- ${reflection.date}：${title}${reflection.content}`);
    }
    lines.push('');
  }

  if (source.periodType === 'yearly') {
    lines.push(
      `${getYear(source.range.start)} 年共读完 ${source.books.length} 本书，收藏 ${source.reflections.length} 条感悟。`,
    );
  }

  return lines.join('\n').trim();
}

/** Prompt for the optional server-side AI path. Constraints mirror the spec. */
export function buildAiPrompt(source: ReviewSourceData): string {
  const label = PERIOD_LABEL[source.periodType];
  return [
    '你在帮助一位用户回顾他自己的成长记录。',
    '',
    '严格约束：',
    '- 只能基于下面提供的真实记录进行总结。',
    '- 不得编造任何事件、书籍、运动或感悟。',
    '- 数据不足时直接说明，不要强行分析。',
    '- 不使用夸张鼓励或说教语气，不给用户贴人格标签。',
    '- 不把"没有打卡"解释为懒惰、不自律或失败。',
    '- 不进行未经请求的心理分析。',
    '- 使用简体中文，语气自然、克制。',
    '',
    `请生成一份${label}回顾，包含：做过的事情、六个维度的简单回顾、值得记住的文字记录、出现过的想法或思考。`,
    '',
    '以下是真实记录数据（JSON）：',
    '```json',
    JSON.stringify(source, null, 2),
    '```',
  ].join('\n');
}
