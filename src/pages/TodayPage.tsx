import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORY_ORDER } from '../domain/categories';
import {
  formatLongDate,
  formatWeekday,
  isFutureLocalDate,
  shiftLocalDate,
  todayLocalDate,
  type LocalDate,
} from '../domain/dates';
import { indexRecords } from '../domain/selectors';
import { useGrowthStore } from '../store/GrowthStore';
import { GrowthCard } from '../components/GrowthCard';
import { BookDialog } from '../components/BookDialog';
import { Button, IconButton } from '../components/ui';

function greeting(hour: number): string {
  if (hour < 5) return '夜深了，今天过得怎么样';
  if (hour < 11) return '早上好，今天想记下什么';
  if (hour < 14) return '中午好，记一笔再继续';
  if (hour < 18) return '下午好，今天过得怎么样';
  return '晚上好，回头看看今天';
}

export function TodayPage() {
  const { records, reflections, addBook, collectThinking, uncollectThinking } = useGrowthStore();
  const today = todayLocalDate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  // The URL carries the day being edited, so a deep link from the calendar and
  // a page refresh both land on the same date.
  const requested = searchParams.get('date');
  const selectedDate = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;

  const setSelectedDate = (date: LocalDate) => {
    if (date === today) setSearchParams({}, { replace: true });
    else setSearchParams({ date }, { replace: true });
  };

  const index = useMemo(() => indexRecords(records), [records]);
  const dayRecords = index.get(selectedDate);
  const completedCount = CATEGORY_ORDER.filter(
    (meta) => dayRecords?.get(meta.key)?.completed,
  ).length;

  const thinkingRecord = dayRecords?.get('thinking');
  const collected = useMemo(
    () =>
      Boolean(
        thinkingRecord &&
          reflections.some(
            (reflection) => reflection.sourceDailyRecordId === thinkingRecord.id,
          ),
      ),
    [reflections, thinkingRecord],
  );

  const isToday = selectedDate === today;
  const isFuture = isFutureLocalDate(selectedDate);
  const canGoForward = !isFutureLocalDate(shiftLocalDate(selectedDate, 1));

  const toggleCollect = async () => {
    setCollectError(null);
    try {
      if (collected) await uncollectThinking(selectedDate);
      else await collectThinking(selectedDate);
    } catch (error) {
      setCollectError(error instanceof Error ? error.message : '操作失败');
    }
  };

  return (
    <div>
      <header className="mb-5 px-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                {formatLongDate(selectedDate)}
              </h1>
              <span className="text-sm text-ink-faint">{formatWeekday(selectedDate)}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {isToday ? greeting(new Date().getHours()) : '查看并补充这一天的记录'}
              <span className="mx-1.5 text-ink-faint">·</span>
              {isToday ? '今日已完成' : '这天已完成'} {completedCount}/6
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton
              label="前一天"
              onClick={() => setSelectedDate(shiftLocalDate(selectedDate, -1))}
            >
              <ChevronLeft size={19} />
            </IconButton>
            <IconButton
              label="后一天"
              disabled={!canGoForward}
              onClick={() => setSelectedDate(shiftLocalDate(selectedDate, 1))}
            >
              <ChevronRight size={19} />
            </IconButton>
            {!isToday ? (
              <Button variant="quiet" onClick={() => setSelectedDate(today)} className="ml-1">
                回到今天
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {collectError ? (
        <p className="mb-3 px-1 text-xs text-[#a8503f]">{collectError}</p>
      ) : null}

      {/* One column keeps the reading and typing rhythm comfortable; two columns
          on wide screens keeps all six visible without scrolling. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {CATEGORY_ORDER.map((meta) => (
          <GrowthCard
            key={meta.key}
            meta={meta}
            localDate={selectedDate}
            record={dayRecords?.get(meta.key)}
            collected={meta.key === 'thinking' ? collected : undefined}
            onToggleCollect={meta.key === 'thinking' ? () => void toggleCollect() : undefined}
            onAddBook={meta.key === 'reading' ? () => setBookDialogOpen(true) : undefined}
            readOnlyReason={isFuture ? '这一天还没有到' : undefined}
          />
        ))}
      </div>

      <BookDialog
        open={bookDialogOpen}
        defaultFinishedDate={selectedDate}
        linkedDailyRecordId={dayRecords?.get('reading')?.id}
        onClose={() => setBookDialogOpen(false)}
        onSubmit={async (input) => {
          await addBook(input);
        }}
      />
    </div>
  );
}
