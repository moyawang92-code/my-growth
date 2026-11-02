import { useState } from 'react';
import { BookPlus, Pencil, Trash2 } from 'lucide-react';
import type { Book } from '../domain/types';
import { formatLongDate } from '../domain/dates';
import { useGrowthStore } from '../store/GrowthStore';
import { BookCover } from './BookCover';
import { BookDialog } from './BookDialog';
import { Button, Card, EmptyState, Modal, SectionTitle } from './ui';

export function Bookshelf({ books, year }: { books: Book[]; year: number }) {
  const { addBook, editBook, removeBook } = useGrowthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Book | undefined>(undefined);
  const [detail, setDetail] = useState<Book | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);

  const sorted = [...books].sort((a, b) => b.finishedDate.localeCompare(a.finishedDate));

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle
        title={`今年读完的书 · ${sorted.length} 本`}
        description={`按读完日期排列，归属 ${year} 年`}
        action={
          <Button
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <BookPlus size={15} />
            添加书籍
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title={`${year} 年的第一本书，从这里开始`}
          description="读完一本书之后，把它放进书架。只填书名也可以。"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(undefined);
                setDialogOpen(true);
              }}
            >
              添加第一本书
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {sorted.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => setDetail(book)}
                className="group w-full text-left"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line shadow-sm transition-transform group-hover:-translate-y-0.5">
                  <BookCover title={book.title} coverUrl={book.coverUrl} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium text-ink">
                  {book.title}
                </p>
                {book.author ? (
                  <p className="line-clamp-1 text-[11px] text-ink-faint">{book.author}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <BookDialog
        open={dialogOpen}
        book={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(undefined);
        }}
        onSubmit={async (input) => {
          if (editing) await editBook(editing.id, input);
          else await addBook(input);
        }}
      />

      <Modal
        open={detail !== null}
        title={detail?.title ?? ''}
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  setPendingDelete(detail);
                  setDetail(null);
                }}
              >
                <Trash2 size={15} />
                删除
              </Button>
              <Button
                onClick={() => {
                  setEditing(detail);
                  setDetail(null);
                  setDialogOpen(true);
                }}
              >
                <Pencil size={15} />
                编辑
              </Button>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="flex gap-4">
            <div className="h-36 w-24 shrink-0 overflow-hidden rounded-lg border border-line">
              <BookCover title={detail.title} coverUrl={detail.coverUrl} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 text-sm">
              <p className="font-medium text-ink">{detail.title}</p>
              <p className="text-ink-soft">{detail.author || '未填写作者'}</p>
              <p className="text-xs text-ink-faint">
                读完于 {formatLongDate(detail.finishedDate)}
              </p>
              {detail.note ? (
                <p className="text-balance-zh mt-2 whitespace-pre-wrap text-ink-soft">
                  {detail.note}
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-faint">还没有写读后感</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={pendingDelete !== null}
        title="删除这本书？"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (pendingDelete) await removeBook(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          《{pendingDelete?.title}》将从年度书架中移除，这个操作无法撤销。
        </p>
      </Modal>
    </Card>
  );
}
