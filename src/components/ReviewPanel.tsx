import { useMemo, useState } from 'react';
import { Info, RefreshCw, Sparkles } from 'lucide-react';
import type { ReviewPeriod } from '../domain/types';
import type { DateRange } from '../domain/dates';
import { formatLongDate } from '../domain/dates';
import {
  buildLocalSummary,
  buildReviewSource,
  hasEnoughData,
} from '../domain/reviewInput';
import { latestUpdatedAt, resolveReflections } from '../domain/selectors';
import { generateAiReview, isAiConfigured } from '../data/aiClient';
import { useGrowthStore } from '../store/GrowthStore';
import { Button, Card, cx } from './ui';

const PERIOD_LABEL: Record<ReviewPeriod, string> = {
  weekly: '本周回顾',
  monthly: '本月回顾',
  yearly: '年度回顾',
};

/** Minimal Markdown rendering for the generated text: headings, bullets, bold. */
function ReviewBody({ content }: { content: string }) {
  const blocks = content.split('\n');
  return (
    <div className="space-y-1.5">
      {blocks.map((line, lineIndex) => {
        const key = `${lineIndex}-${line.slice(0, 12)}`;
        if (line.startsWith('### ')) {
          return (
            <h4 key={key} className="pt-2 text-sm font-semibold text-ink">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={key} className="pt-1 text-[15px] font-semibold text-ink">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <p key={key} className="text-balance-zh pl-4 text-sm text-ink-soft">
              · {renderInline(line.slice(2))}
            </p>
          );
        }
        if (line.trim().length === 0) return <div key={key} className="h-1" />;
        return (
          <p key={key} className="text-balance-zh text-sm text-ink-soft">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function ReviewPanel({
  periodType,
  range,
  title,
}: {
  periodType: ReviewPeriod;
  range: DateRange;
  title?: string;
}) {
  const { records, books, reflections, reviews, persistReview } = useGrowthStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const resolved = useMemo(() => resolveReflections(reflections, records), [reflections, records]);
  const source = useMemo(
    () => buildReviewSource({ periodType, range, records, books, reflections: resolved }),
    [periodType, range, records, books, resolved],
  );

  const saved = reviews.find(
    (review) =>
      review.periodType === periodType &&
      review.periodStart === range.start &&
      review.periodEnd === range.end,
  );

  const currentSourceStamp = useMemo(
    () =>
      latestUpdatedAt([
        ...records.filter(
          (record) => record.localDate >= range.start && record.localDate <= range.end,
        ),
        ...books.filter(
          (book) => book.finishedDate >= range.start && book.finishedDate <= range.end,
        ),
        ...reflections,
      ]),
    [records, books, reflections, range],
  );

  const stale = Boolean(saved && currentSourceStamp > saved.sourceUpdatedAt);
  const enough = hasEnoughData(source);

  const generate = async (useAi: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      let content: string;
      let engine: 'ai' | 'local' = 'local';
      if (useAi) {
        try {
          content = await generateAiReview(source);
          engine = 'ai';
        } catch (error) {
          // AI failing must never block the feature: fall back and say so.
          content = buildLocalSummary(source);
          setNotice(
            `${error instanceof Error ? error.message : 'AI 调用失败'}，已改为生成本地摘要。`,
          );
        }
      } else {
        content = buildLocalSummary(source);
      }
      await persistReview({
        periodType,
        periodStart: range.start,
        periodEnd: range.end,
        generatedContent: content,
        sourceUpdatedAt: currentSourceStamp,
        engine,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title ?? PERIOD_LABEL[periodType]}</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {formatLongDate(range.start)} — {formatLongDate(range.end)}
          </p>
        </div>
        <div className="flex gap-2">
          {isAiConfigured() ? (
            <Button variant="primary" onClick={() => void generate(true)} disabled={busy || !enough}>
              <Sparkles size={15} />
              {busy ? '生成中…' : saved ? '重新生成' : '生成回顾'}
            </Button>
          ) : null}
          <Button onClick={() => void generate(false)} disabled={busy || !enough}>
            {isAiConfigured() ? (
              '本地摘要'
            ) : (
              <>
                <RefreshCw size={15} />
                {busy ? '生成中…' : saved ? '重新生成' : '生成本地摘要'}
              </>
            )}
          </Button>
        </div>
      </div>

      {!enough ? (
        <p className="rounded-xl bg-canvas px-3.5 py-3 text-sm text-ink-soft">
          这段时间还没有足够的记录，先去记几条再回来看。
        </p>
      ) : null}

      {notice ? (
        <p className="mb-3 rounded-xl border border-[#e3c9c3] bg-[#fdf3f1] px-3.5 py-2.5 text-xs text-[#a8503f]">
          {notice}
        </p>
      ) : null}

      {!isAiConfigured() ? (
        <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
          <Info size={13} className="mt-0.5 shrink-0" />
          当前没有配置 AI 服务，生成的是按真实记录整理的本地摘要（不含 AI 解读）。配置方式见 README。
        </p>
      ) : null}

      {saved ? (
        <div className={cx('rounded-xl bg-canvas px-4 py-3.5', !enough && 'mt-3')}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
            <span className="rounded-full bg-surface px-2 py-0.5">
              {saved.engine === 'ai' ? 'AI 生成' : '本地摘要'}
            </span>
            <span>生成于 {new Date(saved.generatedAt).toLocaleString('zh-CN')}</span>
            {stale ? (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-gold-500">
                记录有更新，这份回顾可能已过时
              </span>
            ) : null}
          </div>
          <ReviewBody content={saved.generatedContent} />
        </div>
      ) : null}
    </Card>
  );
}
