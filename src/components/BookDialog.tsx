import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { Book } from '../domain/types';
import type { BookInput } from '../data/repository';
import { todayLocalDate, type LocalDate } from '../domain/dates';
import { AutoGrowTextarea, Button, Field, inputClass, Modal } from './ui';
import { BookCover } from './BookCover';

const MAX_COVER_BYTES = 2 * 1024 * 1024;

export interface BookDialogProps {
  open: boolean;
  /** Present when editing; absent when adding. */
  book?: Book;
  defaultFinishedDate?: LocalDate;
  linkedDailyRecordId?: string;
  onClose: () => void;
  onSubmit: (input: BookInput) => Promise<void>;
}

export function BookDialog({
  open,
  book,
  defaultFinishedDate,
  linkedDailyRecordId,
  onClose,
  onSubmit,
}: BookDialogProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [finishedDate, setFinishedDate] = useState<LocalDate>(todayLocalDate());
  const [note, setNote] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(book?.title ?? '');
    setAuthor(book?.author ?? '');
    setFinishedDate(book?.finishedDate ?? defaultFinishedDate ?? todayLocalDate());
    setNote(book?.note ?? '');
    setCoverUrl(book?.coverUrl ?? '');
    setError(null);
    setBusy(false);
  }, [open, book, defaultFinishedDate]);

  const pickCover = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件作为封面');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError('封面图片请控制在 2MB 以内');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCoverUrl(typeof reader.result === 'string' ? reader.result : '');
      setError(null);
    };
    reader.onerror = () => setError('封面读取失败，请换一张图片');
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('书名是唯一必填项');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        title: trimmed,
        author: author.trim(),
        coverUrl,
        finishedDate,
        note: note.trim(),
        linkedDailyRecordId: book?.linkedDailyRecordId ?? linkedDailyRecordId,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={book ? '编辑书籍' : '读完一本书'}
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? '保存中…' : book ? '保存修改' : '加入书架'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="书名" hint="只有书名是必填的，其他都可以之后再补。">
          <input
            className={inputClass}
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            placeholder="例如：《被讨厌的勇气》"
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="作者（可选）">
            <input
              className={inputClass}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="留空也可以"
            />
          </Field>
          <Field label="读完日期">
            <input
              type="date"
              className={inputClass}
              value={finishedDate}
              max={todayLocalDate()}
              onChange={(event) => {
                if (event.target.value) setFinishedDate(event.target.value);
              }}
            />
          </Field>
        </div>

        <Field label="封面（可选）" hint="不上传时使用根据书名生成的简洁占位封面。">
          <div className="flex items-center gap-3">
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
              <BookCover title={title || '未命名'} coverUrl={coverUrl} />
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => pickCover(event.target.files?.[0])}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <ImagePlus size={15} />
                上传封面
              </Button>
              {coverUrl ? (
                <Button variant="quiet" onClick={() => setCoverUrl('')}>
                  <Trash2 size={15} />
                  移除封面
                </Button>
              ) : null}
            </div>
          </div>
        </Field>

        <Field label="一句话读后感（可选）">
          <div className="rounded-xl border border-line-strong px-3 py-2">
            <AutoGrowTextarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="读完之后留下的想法…"
              minRows={2}
            />
          </div>
        </Field>

        {error ? <p className="text-xs text-[#a8503f]">{error}</p> : null}
      </div>
    </Modal>
  );
}
