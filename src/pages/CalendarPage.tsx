import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { CATEGORY_ORDER } from '../domain/categories';
import {
  formatLongDate,
  formatMonthTitle,
  formatWeekday,
  getMonthKey,
  monthRange,
  shiftLocalMonth,
  todayLocalDate,
  weekRange,
  type LocalDate,
} from '../domain/dates';
import { indexRecords } from '../domain/selectors';
import { useGrowthStore } from '../store/GrowthStore';
import { GrowthCard } from '../components/GrowthCard';
import { MonthCalendar } from '../components/MonthCalendar';
import { GrowthStats } from '../components/GrowthStats';
import { HistoryList } from '../components/HistoryList';
import { ReviewPanel } from '../components/ReviewPanel';
import { BookDialog } from '../components/BookDialog';
import { Button, Card, IconButton } from '../components/ui';

export function CalendarPage() {
  const { records, reflections, addBook, collectThinking, uncollectThinking } = useGrowthStore();
  const navigate = useNavigate();
  const today = todayLocalDate();
  const [month, setMonth] = useState<LocalDate>(today);
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  const index = useMemo(() => indexRecords(records), [records]);
  const dayRecords = index.get(selectedDate);

  const thinkingRecord = dayRecords?.get('thinking');
  const collected = Boolean(
    thinkingRecord &&
      reflections.some((reflection) => reflection.sourceDailyRecordId === thinkingRecord.id),
  );

  const selectDate = (date: LocalDate) => {
    setSelectedDate(date);
    // Keep the grid on the month the user is actually looking at.
    if (getMonthKey(date) !== getMonthKey(month)) setMonth(date);
  };

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
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">成长日历</h1>
        <p className="mt-1 text-sm text-ink-soft">看看过去的每一天，你做过哪些事情。</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="p-3.5 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">{formatMonthTitle(month)}</h2>
            <div className="flex items-center gap-0.5">
              <IconButton label="上个月" onClick={() => setMonth(shiftLocalMonth(month, -1))}>
                <ChevronLeft size={19} />
              </IconButton>
              <IconButton label="下个月" onClick={() => setMonth(shiftLocalMonth(month, 1))}>
                <ChevronRight size={19} />
              </IconButton>
              <Button
                variant="quiet"
                className="ml-1"
                onClick={() => {
                  setMonth(today);
                  setSelectedDate(today);
                }}
              >
                本月
              </Button>
            </div>
          </div>

          <MonthCalendar
            month={month}
            index={index}
            selectedDate={selectedDate}
            onSelect={selectDate}
          />

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] text-ink-faint">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-sage-50 ring-1 ring-line" />1–2 项
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-sage-100 ring-1 ring-line" />3–4 项
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-sage-200 ring-1 ring-line" />5–6 项
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />仅有文字记录
            </span>
          </div>
        </Card>

        {/* Day detail: the same autosaving cards as the Today page, so the text
            shown here is always the live record, never a copy. */}
        <div className="space-y-3">
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                  <CalendarDays size={16} className="text-sage-500" />
                  {formatLongDate(selectedDate)}
                </h2>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {formatWeekday(selectedDate)} · 可直接在这里补充或修改
                </p>
              </div>
              <Button variant="quiet" onClick={() => navigate(`/today?date=${selectedDate}`)}>
                <ExternalLink size={14} />
                去记录页
              </Button>
            </div>

            {collectError ? (
              <p className="mb-2 text-xs text-[#a8503f]">{collectError}</p>
            ) : null}

            <div className="space-y-2.5">
              {CATEGORY_ORDER.map((meta) => (
                <GrowthCard
                  key={meta.key}
                  meta={meta}
                  localDate={selectedDate}
                  record={dayRecords?.get(meta.key)}
                  collected={meta.key === 'thinking' ? collected : undefined}
                  onToggleCollect={
                    meta.key === 'thinking' ? () => void toggleCollect() : undefined
                  }
                  onAddBook={meta.key === 'reading' ? () => setBookDialogOpen(true) : undefined}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <GrowthStats anchorDate={selectedDate} index={index} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewPanel periodType="weekly" range={weekRange(selectedDate)} />
        <ReviewPanel periodType="monthly" range={monthRange(month)} />
      </div>

      <HistoryList records={records} onOpenDate={selectDate} />

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
