import { CATEGORY_META } from '../domain/categories';
import type { Category } from '../domain/types';
import {
  dayOfMonth,
  getMonthKey,
  isFutureLocalDate,
  monthGrid,
  todayLocalDate,
  WEEKDAY_HEADERS,
  type LocalDate,
} from '../domain/dates';
import { completedCategories, isRecordedDay, type RecordsByDate } from '../domain/selectors';
import { cx } from './ui';

/** Colour depth is a secondary cue; the icons carry the actual content. */
function shadeFor(count: number): string {
  if (count === 0) return 'bg-surface';
  if (count <= 2) return 'bg-sage-50';
  if (count <= 4) return 'bg-sage-100';
  return 'bg-sage-200';
}

function DayCell({
  date,
  inMonth,
  completed,
  recorded,
  selected,
  isToday,
  onSelect,
}: {
  date: LocalDate;
  inMonth: boolean;
  completed: Category[];
  recorded: boolean;
  selected: boolean;
  isToday: boolean;
  onSelect: (date: LocalDate) => void;
}) {
  const future = isFutureLocalDate(date);
  const label = [
    date,
    future
      ? '未来日期'
      : completed.length > 0
        ? `已完成：${completed.map((category) => CATEGORY_META[category].label).join('、')}`
        : recorded
          ? '有文字记录，未勾选完成'
          : '没有记录',
  ].join('，');

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={label}
      aria-current={isToday ? 'date' : undefined}
      aria-pressed={selected}
      className={cx(
        // min-h keeps six icons from overflowing even on narrow phones.
        'relative flex min-h-16 flex-col items-center gap-1 rounded-xl border p-1 transition-colors sm:min-h-20 sm:p-1.5',
        shadeFor(future ? 0 : completed.length),
        selected ? 'border-sage-400 ring-1 ring-sage-300' : 'border-line hover:border-sage-300',
        !inMonth && 'opacity-40',
      )}
    >
      <span
        className={cx(
          'flex h-5 w-5 items-center justify-center rounded-full text-[11px] sm:text-xs',
          isToday ? 'bg-sage-500 font-semibold text-white' : 'text-ink-soft',
        )}
      >
        {dayOfMonth(date)}
      </span>

      {/* Up to six icons in a fixed 3-column grid: never overlapping, never clipped. */}
      <span className="grid w-full grid-cols-3 justify-items-center gap-px" aria-hidden="true">
        {completed.map((category) => {
          const Icon = CATEGORY_META[category].icon;
          return (
            <Icon
              key={category}
              size={11}
              strokeWidth={2}
              className="text-sage-600 sm:h-3.5 sm:w-3.5"
            />
          );
        })}
      </span>

      {completed.length === 0 && recorded ? (
        <span
          className="absolute right-1.5 bottom-1.5 h-1.5 w-1.5 rounded-full bg-gold-300"
          aria-hidden="true"
          title="有文字记录"
        />
      ) : null}
    </button>
  );
}

export function MonthCalendar({
  month,
  index,
  selectedDate,
  onSelect,
}: {
  month: LocalDate;
  index: RecordsByDate;
  selectedDate: LocalDate;
  onSelect: (date: LocalDate) => void;
}) {
  const grid = monthGrid(month);
  const monthKey = getMonthKey(month);
  const today = todayLocalDate();

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] text-ink-faint">
            {label}
          </div>
        ))}
      </div>
      {/* Seven columns always fit: the grid never scrolls horizontally. */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {grid.map((date) => (
          <DayCell
            key={date}
            date={date}
            inMonth={getMonthKey(date) === monthKey}
            completed={completedCategories(index, date)}
            recorded={isRecordedDay(index, date)}
            selected={date === selectedDate}
            isToday={date === today}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
