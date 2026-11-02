import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CATEGORY_META, CATEGORY_ORDER } from '../domain/categories';
import type { Category, DailyRecord } from '../domain/types';
import {
  formatLongDate,
  shiftLocalDate,
  todayLocalDate,
  yearRange,
  type LocalDate,
} from '../domain/dates';
import { Button, Card, cx, EmptyState, inputClass } from './ui';

type RangeOption = 'month' | 'quarter' | 'year' | 'all';

const RANGE_LABELS: Record<RangeOption, string> = {
  month: '最近一个月',
  quarter: '最近三个月',
  year: '今年',
  all: '全部',
};

function rangeStart(option: RangeOption, today: LocalDate): LocalDate {
  if (option === 'month') return shiftLocalDate(today, -30);
  if (option === 'quarter') return shiftLocalDate(today, -90);
  if (option === 'year') return yearRange(Number(today.slice(0, 4))).start;
  return '0000-01-01';
}

export function HistoryList({
  records,
  onOpenDate,
}: {
  records: DailyRecord[];
  onOpenDate: (date: LocalDate) => void;
}) {
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [range, setRange] = useState<RangeOption>('month');
  const [keyword, setKeyword] = useState('');
  const today = todayLocalDate();

  const filtered = useMemo(() => {
    const start = rangeStart(range, today);
    const needle = keyword.trim().toLowerCase();
    return records
      .filter((record) => record.content.trim().length > 0)
      .filter((record) => record.localDate >= start)
      .filter((record) => (category === 'all' ? true : record.category === category))
      .filter((record) =>
        needle.length === 0 ? true : record.content.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.localDate.localeCompare(a.localDate));
  }, [records, category, range, keyword, today]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">历史记录</h2>
          <p className="mt-0.5 text-xs text-ink-faint">回顾某个维度留下的文字</p>
        </div>
        <span className="shrink-0 text-xs text-ink-faint">{filtered.length} 条</span>
      </div>

      <div className="mb-3 space-y-2.5">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          />
          <input
            className={cx(inputClass, 'pl-9')}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索记录里的关键词"
            aria-label="搜索历史记录"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="quiet"
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
            className={cx(
              'px-3 py-1 text-xs',
              category === 'all' && 'bg-sage-100 font-medium text-sage-600',
            )}
          >
            全部维度
          </Button>
          {CATEGORY_ORDER.map((meta) => (
            <Button
              key={meta.key}
              variant="quiet"
              onClick={() => setCategory(meta.key)}
              aria-pressed={category === meta.key}
              className={cx(
                'px-3 py-1 text-xs',
                category === meta.key && 'bg-sage-100 font-medium text-sage-600',
              )}
            >
              {meta.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(RANGE_LABELS) as RangeOption[]).map((option) => (
            <Button
              key={option}
              variant="quiet"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={cx(
                'px-3 py-1 text-xs',
                range === option && 'bg-canvas font-medium text-ink',
              )}
            >
              {RANGE_LABELS[option]}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="这个范围内还没有文字记录"
          description="换一个维度或时间范围看看，或者今天先写一条。"
        />
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((record) => {
            const meta = CATEGORY_META[record.category];
            const Icon = meta.icon;
            return (
              <li key={record.id} className="py-3">
                <button
                  type="button"
                  onClick={() => onOpenDate(record.localDate)}
                  className="group w-full text-left"
                >
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    <Icon size={13} className="text-sage-500" aria-hidden="true" />
                    <span className="font-medium text-ink-soft">{meta.label}</span>
                    <span>{formatLongDate(record.localDate)}</span>
                    {record.completed ? (
                      <span className="rounded-full bg-sage-50 px-1.5 py-0.5 text-[10px] text-sage-600">
                        已完成
                      </span>
                    ) : null}
                  </div>
                  <p className="text-balance-zh mt-1 text-sm whitespace-pre-wrap text-ink group-hover:text-sage-600">
                    {record.content}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
