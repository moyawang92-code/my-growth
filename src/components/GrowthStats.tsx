import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_ORDER } from '../domain/categories';
import {
  eachLocalDate,
  getMonthKey,
  monthRange,
  weekRange,
  yearRange,
  type LocalDate,
} from '../domain/dates';
import { computeRangeStats, isRecordedDay, type RecordsByDate } from '../domain/selectors';
import { Button, Card, cx } from './ui';

type ViewMode = 'week' | 'month' | 'year';

const VIEW_LABELS: Record<ViewMode, string> = { week: '周', month: '月', year: '年' };

export function GrowthStats({
  anchorDate,
  index,
}: {
  anchorDate: LocalDate;
  index: RecordsByDate;
}) {
  const [view, setView] = useState<ViewMode>('month');

  const range = useMemo(() => {
    if (view === 'week') return weekRange(anchorDate);
    if (view === 'month') return monthRange(anchorDate);
    return yearRange(Number(anchorDate.slice(0, 4)));
  }, [view, anchorDate]);

  const stats = useMemo(() => computeRangeStats(index, range), [index, range]);

  const perCategory = CATEGORY_ORDER.map((meta) => ({
    key: meta.key,
    name: meta.label,
    count: stats.completionsByCategory[meta.key],
  }));

  // Daily buckets for week/month, monthly buckets for the year view.
  const trend = useMemo(() => {
    const dates = eachLocalDate(range);
    if (view === 'year') {
      const buckets = new Map<string, number>();
      for (const date of dates) {
        const key = getMonthKey(date);
        const dayCount = CATEGORY_ORDER.filter(
          (meta) => index.get(date)?.get(meta.key)?.completed,
        ).length;
        buckets.set(key, (buckets.get(key) ?? 0) + dayCount);
      }
      return [...buckets.entries()].map(([key, count]) => ({
        label: `${Number(key.slice(5, 7))}月`,
        count,
      }));
    }
    return dates.map((date) => ({
      label: view === 'week' ? date.slice(5) : String(Number(date.slice(8, 10))),
      count: CATEGORY_ORDER.filter((meta) => index.get(date)?.get(meta.key)?.completed).length,
    }));
  }, [range, view, index]);

  const recordedDaysInRange = useMemo(
    () => eachLocalDate(range).filter((date) => isRecordedDay(index, date)).length,
    [range, index],
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">成长统计</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {range.start} — {range.end}
          </p>
        </div>
        <div className="flex gap-0.5 rounded-full bg-canvas p-0.5">
          {(['week', 'month', 'year'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant="quiet"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={cx(
                'px-3 py-1 text-xs',
                view === mode && 'bg-surface font-medium text-sage-600 shadow-sm',
              )}
            >
              {VIEW_LABELS[mode]}
            </Button>
          ))}
        </div>
      </div>

      {/* The two metrics below are counted differently on purpose. */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-canvas px-3.5 py-3">
          <p className="text-xl font-semibold text-ink">{recordedDaysInRange}</p>
          <p className="mt-0.5 text-xs text-ink-soft">有记录的天数</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">
            勾选完成 <span className="font-medium">或</span> 写了文字的日期
          </p>
        </div>
        <div className="rounded-xl bg-canvas px-3.5 py-3">
          <p className="text-xl font-semibold text-ink">{stats.totalCompletions}</p>
          <p className="mt-0.5 text-xs text-ink-soft">完成次数</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">
            只统计<span className="font-medium">勾选完成</span>的维度
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">各维度完成次数</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perCategory} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="#ebe5dc" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b665f' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9c968d' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #ebe5dc',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} 次`, '完成']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {perCategory.map((entry) => (
                    <Cell key={entry.key} fill="#8aa87f" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">完成趋势</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="#ebe5dc" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9c968d' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9c968d' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, view === 'year' ? 'auto' : 6]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #ebe5dc',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} 项`, '完成']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6f8e66"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
        统计只反映记录本身，不构成评分。没有记录的日子不代表什么。
      </p>
    </Card>
  );
}
