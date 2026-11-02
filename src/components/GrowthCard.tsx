import { BookPlus, Bookmark, Check } from 'lucide-react';
import type { CategoryMeta } from '../domain/categories';
import type { DailyRecord } from '../domain/types';
import type { LocalDate } from '../domain/dates';
import { useAutosaveText } from '../hooks/useAutosaveText';
import { saveKey, useGrowthStore } from '../store/GrowthStore';
import { AutoGrowTextarea, Card, cx, IconButton } from './ui';
import { SaveIndicator } from './SaveIndicator';

export function GrowthCard({
  meta,
  localDate,
  record,
  collected,
  onToggleCollect,
  onAddBook,
  readOnlyReason,
}: {
  meta: CategoryMeta;
  localDate: LocalDate;
  record: DailyRecord | undefined;
  /** Only used by the thinking card: whether it is in the yearly collection. */
  collected?: boolean;
  onToggleCollect?: () => void;
  onAddBook?: () => void;
  readOnlyReason?: string;
}) {
  const { setCompleted, saveStates, setContent } = useGrowthStore();
  const storedContent = record?.content ?? '';
  const { draft, onChange } = useAutosaveText(localDate, meta.key, storedContent);
  const completed = record?.completed ?? false;
  const state = saveStates[saveKey(localDate, meta.key)] ?? 'idle';
  const Icon = meta.icon;
  const disabled = Boolean(readOnlyReason);
  const hasText = draft.trim().length > 0;

  return (
    <Card
      className={cx(
        'px-4 py-3.5 transition-colors sm:px-5 sm:py-4',
        completed ? 'border-sage-200 bg-sage-50/40' : 'hover:border-line-strong',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
            completed ? 'bg-sage-100 text-sage-600' : 'bg-canvas text-ink-soft',
          )}
          aria-hidden="true"
        >
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <h3 className="flex-1 text-[15px] font-medium text-ink">{meta.label}</h3>

        <SaveIndicator state={state} onRetry={() => void setContent(localDate, meta.key, draft)} />

        {meta.key === 'reading' && onAddBook ? (
          <IconButton label="读完一本书" onClick={onAddBook} disabled={disabled}>
            <BookPlus size={17} />
          </IconButton>
        ) : null}

        {meta.key === 'thinking' && onToggleCollect ? (
          <IconButton
            label={
              collected
                ? '移出年度感悟'
                : hasText
                  ? '收藏到年度感悟'
                  : '请先写下思考，再收藏到年度感悟'
            }
            aria-pressed={collected}
            onClick={onToggleCollect}
            // Nothing to collect until there is text.
            disabled={disabled || (!collected && !hasText)}
            className={collected ? 'text-gold-500 hover:text-gold-500' : undefined}
          >
            <Bookmark size={17} fill={collected ? 'currentColor' : 'none'} />
          </IconButton>
        ) : null}

        <button
          type="button"
          role="checkbox"
          aria-checked={completed}
          aria-label={`${meta.label}已完成`}
          disabled={disabled}
          title={readOnlyReason}
          onClick={() => void setCompleted(localDate, meta.key, !completed)}
          className={cx(
            'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            completed
              ? 'border-sage-300 bg-sage-200/60 text-sage-600'
              : 'border-line-strong text-ink-faint hover:border-sage-300 hover:text-sage-600',
          )}
        >
          <Check size={13} strokeWidth={2.6} className={completed ? undefined : 'opacity-40'} />
          {completed ? '已完成' : '完成'}
        </button>
      </div>

      {/* Always-visible input: no "record" button stands between the user and typing. */}
      <div className="mt-2 pl-0 sm:pl-10.5">
        <AutoGrowTextarea
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          placeholder={disabled ? readOnlyReason : meta.placeholder}
          disabled={disabled}
          aria-label={`${meta.label}记录`}
          minRows={2}
          className="text-balance-zh"
        />
      </div>
    </Card>
  );
}
