import { useMemo, useState } from 'react';
import { BookmarkX, Lightbulb, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { ResolvedReflection } from '../domain/selectors';
import { formatLongDate, todayLocalDate, type LocalDate } from '../domain/dates';
import { useGrowthStore } from '../store/GrowthStore';
import {
  AutoGrowTextarea,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  IconButton,
  inputClass,
  Modal,
  SectionTitle,
} from './ui';

interface DraftState {
  id?: string;
  title: string;
  content: string;
  reflectionDate: LocalDate;
}

export function ReflectionTimeline({
  reflections,
  year,
}: {
  reflections: ResolvedReflection[];
  year: number;
}) {
  const { addReflection, editReflection, removeReflection, uncollectThinking } = useGrowthStore();
  const [keyword, setKeyword] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResolvedReflection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => {
    const present = new Set(reflections.map((item) => item.reflectionDate.slice(5, 7)));
    return [...present].sort();
  }, [reflections]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return reflections
      .filter((item) => (monthFilter === 'all' ? true : item.reflectionDate.slice(5, 7) === monthFilter))
      .filter((item) =>
        needle.length === 0
          ? true
          : item.content.toLowerCase().includes(needle) ||
            item.title.toLowerCase().includes(needle),
      );
  }, [reflections, keyword, monthFilter]);

  const submit = async () => {
    if (!draft) return;
    const content = draft.content.trim();
    if (!content) {
      setError('感悟内容不能为空');
      return;
    }
    try {
      if (draft.id) {
        await editReflection(draft.id, {
          title: draft.title,
          content,
          reflectionDate: draft.reflectionDate,
        });
      } else {
        await addReflection({
          title: draft.title,
          content,
          reflectionDate: draft.reflectionDate,
        });
      }
      setDraft(null);
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title={`今年的感悟 · ${reflections.length} 条`}
        description="来自每日思考的收藏，以及单独新增的感悟"
        action={
          <Button
            onClick={() => {
              setError(null);
              setDraft({ title: '', content: '', reflectionDate: todayLocalDate() });
            }}
          >
            <Plus size={15} />
            新增感悟
          </Button>
        }
      />

      {reflections.length > 0 ? (
        <div className="mb-4 space-y-2.5">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
            />
            <input
              className={cx(inputClass, 'pl-9')}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索感悟里的关键词"
              aria-label="搜索年度感悟"
            />
          </div>
          {months.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="quiet"
                onClick={() => setMonthFilter('all')}
                aria-pressed={monthFilter === 'all'}
                className={cx(
                  'px-3 py-1 text-xs',
                  monthFilter === 'all' && 'bg-sage-100 font-medium text-sage-600',
                )}
              >
                全年
              </Button>
              {months.map((month) => (
                <Button
                  key={month}
                  variant="quiet"
                  onClick={() => setMonthFilter(month)}
                  aria-pressed={monthFilter === month}
                  className={cx(
                    'px-3 py-1 text-xs',
                    monthFilter === month && 'bg-sage-100 font-medium text-sage-600',
                  )}
                >
                  {Number(month)} 月
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-3 text-xs text-[#a8503f]">{error}</p> : null}

      {reflections.length === 0 ? (
        <EmptyState
          title={`${year} 年还没有收藏任何感悟`}
          description="在今日思考里写下想法后，点击书签图标收藏到这里；也可以直接新增一条。"
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="没有匹配的感悟" description="换个关键词或月份试试。" />
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-5">
          {filtered.map((item) => (
            <li key={item.id} className="relative">
              <span
                className={cx(
                  'absolute top-2 -left-[23px] h-2.5 w-2.5 rounded-full ring-2 ring-surface',
                  item.sourceType === 'daily' ? 'bg-gold-300' : 'bg-sage-300',
                )}
                aria-hidden="true"
              />
              <article className="rounded-xl bg-canvas px-4 py-3">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                    <span>{formatLongDate(item.reflectionDate)}</span>
                    <span
                      className={cx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                        item.sourceType === 'daily'
                          ? 'bg-gold-100 text-gold-500'
                          : 'bg-sage-50 text-sage-600',
                      )}
                    >
                      {item.sourceType === 'daily' ? (
                        <>
                          <Lightbulb size={11} />
                          来自每日思考
                        </>
                      ) : (
                        '单独新增'
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {item.sourceType === 'manual' ? (
                      <>
                        <IconButton
                          label="编辑感悟"
                          onClick={() => {
                            setError(null);
                            setDraft({
                              id: item.id,
                              title: item.title,
                              content: item.content,
                              reflectionDate: item.reflectionDate,
                            });
                          }}
                        >
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton label="删除感悟" onClick={() => setPendingDelete(item)}>
                          <Trash2 size={15} />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        label="移出年度收藏（保留原始每日思考）"
                        onClick={() => void uncollectThinking(item.reflectionDate)}
                      >
                        <BookmarkX size={15} />
                      </IconButton>
                    )}
                  </div>
                </div>
                {item.title ? (
                  <h3 className="mb-1 text-sm font-semibold text-ink">{item.title}</h3>
                ) : null}
                {item.content ? (
                  <p className="text-balance-zh text-[15px] whitespace-pre-wrap text-ink">
                    {item.content}
                  </p>
                ) : (
                  <p className="text-xs text-ink-faint">
                    原始每日思考已被清空，内容为空。取消收藏不会影响那一天的记录。
                  </p>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? '编辑感悟' : '新增一条感悟'}
        onClose={() => {
          setDraft(null);
          setError(null);
        }}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              取消
            </Button>
            <Button variant="primary" onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3.5">
            <Field label="标题（可选）">
              <input
                className={inputClass}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="可以留空"
              />
            </Field>
            <Field label="内容">
              <div className="rounded-xl border border-line-strong px-3 py-2">
                <AutoGrowTextarea
                  value={draft.content}
                  onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                  placeholder="写下这一年里想留住的想法…"
                  minRows={4}
                  autoFocus
                />
              </div>
            </Field>
            <Field label="记录日期">
              <input
                type="date"
                className={inputClass}
                value={draft.reflectionDate}
                onChange={(event) => {
                  if (event.target.value) {
                    setDraft({ ...draft, reflectionDate: event.target.value });
                  }
                }}
              />
            </Field>
            {error ? <p className="text-xs text-[#a8503f]">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title="删除这条感悟？"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (pendingDelete) await removeReflection(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">这条单独新增的感悟将被删除，无法撤销。</p>
      </Modal>
    </Card>
  );
}
