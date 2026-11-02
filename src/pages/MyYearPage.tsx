import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getYear, todayLocalDate, yearRange } from '../domain/dates';
import { reflectionsForYear, resolveReflections } from '../domain/selectors';
import { useGrowthStore } from '../store/GrowthStore';
import { Bookshelf } from '../components/Bookshelf';
import { ReflectionTimeline } from '../components/ReflectionTimeline';
import { ReviewPanel } from '../components/ReviewPanel';
import { BackupPanel } from '../components/BackupPanel';
import { IconButton } from '../components/ui';

export function MyYearPage() {
  const { records, books, reflections } = useGrowthStore();
  const currentYear = getYear(todayLocalDate());
  const [year, setYear] = useState(currentYear);

  const resolved = useMemo(() => resolveReflections(reflections, records), [reflections, records]);

  // Year membership comes from the dates on the data, never from creation time.
  const yearBooks = useMemo(
    () => books.filter((book) => getYear(book.finishedDate) === year),
    [books, year],
  );
  const yearReflections = useMemo(() => reflectionsForYear(resolved, year), [resolved, year]);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            我的 {year}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            读完 {yearBooks.length} 本书 · 收藏 {yearReflections.length} 条感悟
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="上一年" onClick={() => setYear(year - 1)}>
            <ChevronLeft size={19} />
          </IconButton>
          <span className="min-w-14 text-center text-sm text-ink-soft">{year}</span>
          <IconButton
            label="下一年"
            disabled={year >= currentYear}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight size={19} />
          </IconButton>
        </div>
      </header>

      <Bookshelf books={yearBooks} year={year} />
      <ReflectionTimeline reflections={yearReflections} year={year} />
      <ReviewPanel periodType="yearly" range={yearRange(year)} title={`${year} 年度回顾`} />
      <BackupPanel />
    </div>
  );
}
