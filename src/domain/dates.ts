import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Plain calendar date in `YYYY-MM-DD`, always local. */
export type LocalDate = string;

const WEEK_OPTIONS = { weekStartsOn: 0 } as const; // calendar weeks start on Sunday

export function toLocalDate(date: Date): LocalDate {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parses `YYYY-MM-DD` into a Date at local midnight.
 *
 * `new Date('2026-03-01')` would parse as UTC midnight and can land on the
 * previous day in negative-offset timezones, so the parts are passed to the
 * Date constructor explicitly instead.
 */
export function parseLocalDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function shiftLocalDate(value: LocalDate, days: number): LocalDate {
  return toLocalDate(addDays(parseLocalDate(value), days));
}

export function shiftLocalMonth(value: LocalDate, months: number): LocalDate {
  return toLocalDate(addMonths(parseLocalDate(value), months));
}

export function isFutureLocalDate(value: LocalDate, now: Date = new Date()): boolean {
  return value > todayLocalDate(now);
}

export function getYear(value: LocalDate): number {
  return Number(value.slice(0, 4));
}

export function getMonthKey(value: LocalDate): string {
  return value.slice(0, 7);
}

export interface DateRange {
  start: LocalDate;
  end: LocalDate;
}

export function monthRange(value: LocalDate): DateRange {
  const date = parseLocalDate(value);
  return { start: toLocalDate(startOfMonth(date)), end: toLocalDate(endOfMonth(date)) };
}

export function weekRange(value: LocalDate): DateRange {
  const date = parseLocalDate(value);
  return {
    start: toLocalDate(startOfWeek(date, WEEK_OPTIONS)),
    end: toLocalDate(endOfWeek(date, WEEK_OPTIONS)),
  };
}

export function yearRange(year: number): DateRange {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function isWithinRange(value: LocalDate, range: DateRange): boolean {
  return value >= range.start && value <= range.end;
}

/**
 * Six-week grid (42 cells) covering the month of `value`, padded with the
 * adjacent months so every row has seven aligned columns.
 */
export function monthGrid(value: LocalDate): LocalDate[] {
  const first = startOfMonth(parseLocalDate(value));
  const gridStart = startOfWeek(first, WEEK_OPTIONS);
  return Array.from({ length: 42 }, (_, index) => toLocalDate(addDays(gridStart, index)));
}

export function eachLocalDate(range: DateRange): LocalDate[] {
  const dates: LocalDate[] = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    dates.push(cursor);
    cursor = shiftLocalDate(cursor, 1);
  }
  return dates;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

export function formatWeekday(value: LocalDate): string {
  return WEEKDAY_LABELS[parseLocalDate(value).getDay()];
}

export function formatDisplayDate(value: LocalDate): string {
  const date = parseLocalDate(value);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatLongDate(value: LocalDate): string {
  const date = parseLocalDate(value);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatMonthTitle(value: LocalDate): string {
  const date = parseLocalDate(value);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

export function dayOfMonth(value: LocalDate): number {
  return parseLocalDate(value).getDate();
}
