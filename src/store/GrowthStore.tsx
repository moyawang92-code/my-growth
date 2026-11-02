import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  BackupFile,
  Book,
  Category,
  DailyRecord,
  GrowthReview,
  Reflection,
} from '../domain/types';
import type { LocalDate } from '../domain/dates';
import type {
  BookInput,
  GrowthRepository,
  ReflectionInput,
  ReviewInput,
} from '../data/repository';
import { IndexedDbGrowthRepository } from '../data/indexedDbRepository';
import { forgetDraft, listPendingDrafts, rememberDraft } from '../data/draftBuffer';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface GrowthState {
  loading: boolean;
  loadError: string | null;
  records: DailyRecord[];
  books: Book[];
  reflections: Reflection[];
  reviews: GrowthReview[];
}

export interface GrowthStoreValue extends GrowthState {
  /** Per card (`date::category`) save indicator state. */
  saveStates: Record<string, SaveState>;
  setCompleted(localDate: LocalDate, category: Category, completed: boolean): Promise<void>;
  setContent(localDate: LocalDate, category: Category, content: string): Promise<void>;
  /** Buffers a keystroke so unsaved text survives a reload. */
  noteTyping(localDate: LocalDate, category: Category, content: string): void;
  addBook(input: BookInput): Promise<Book>;
  editBook(id: string, patch: Partial<BookInput>): Promise<void>;
  removeBook(id: string): Promise<void>;
  addReflection(input: ReflectionInput): Promise<void>;
  editReflection(id: string, patch: Partial<ReflectionInput>): Promise<void>;
  removeReflection(id: string): Promise<void>;
  collectThinking(localDate: LocalDate): Promise<void>;
  uncollectThinking(localDate: LocalDate): Promise<void>;
  persistReview(input: ReviewInput): Promise<void>;
  exportBackup(): Promise<BackupFile>;
  importBackup(backup: BackupFile, mode: 'replace' | 'merge'): Promise<void>;
}

const GrowthStoreContext = createContext<GrowthStoreValue | null>(null);

export function saveKey(localDate: LocalDate, category: Category): string {
  return `${localDate}::${category}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

export function GrowthStoreProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository?: GrowthRepository;
}) {
  const repoRef = useRef<GrowthRepository | null>(repository ?? null);
  if (!repoRef.current) repoRef.current = new IndexedDbGrowthRepository();
  const repo = repoRef.current;

  const [state, setState] = useState<GrowthState>({
    loading: true,
    loadError: null,
    records: [],
    books: [],
    reflections: [],
    reviews: [],
  });
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const savedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Mirrors `state.records` so callbacks can look up a record without being
  // re-created on every edit.
  const recordsRef = useRef<DailyRecord[]>([]);
  recordsRef.current = state.records;

  const markSaveState = useCallback((key: string, next: SaveState) => {
    setSaveStates((previous) => ({ ...previous, [key]: next }));
    const timers = savedTimers.current;
    const pending = timers.get(key);
    if (pending) clearTimeout(pending);
    if (next === 'saved') {
      timers.set(
        key,
        setTimeout(() => {
          setSaveStates((previous) =>
            previous[key] === 'saved' ? { ...previous, [key]: 'idle' } : previous,
          );
          timers.delete(key);
        }, 1600),
      );
    }
  }, []);

  useEffect(() => {
    const timers = savedTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const replaceRecord = useCallback((record: DailyRecord) => {
    setState((previous) => {
      const position = previous.records.findIndex(
        (candidate) =>
          candidate.localDate === record.localDate && candidate.category === record.category,
      );
      return {
        ...previous,
        records:
          position === -1
            ? [...previous.records, record]
            : previous.records.map((candidate, index) =>
                index === position ? record : candidate,
              ),
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [records, books, reflections, reviews] = await Promise.all([
          repo.listDailyRecords(),
          repo.listBooks(),
          repo.listReflections(),
          repo.listReviews(),
        ]);
        if (cancelled) return;
        setState({ loading: false, loadError: null, records, books, reflections, reviews });

        // Flush text that was typed but never reached IndexedDB (e.g. the page
        // was reloaded mid-sentence before the debounce fired).
        const recovered: DailyRecord[] = [];
        for (const draft of listPendingDrafts()) {
          const stored = records.find(
            (record) => record.localDate === draft.localDate && record.category === draft.category,
          );
          const alreadyDurable =
            stored && (stored.content === draft.content || stored.updatedAt > draft.typedAt);
          if (alreadyDurable) {
            forgetDraft(draft.localDate, draft.category);
            continue;
          }
          const record = await repo.upsertDailyRecord({
            localDate: draft.localDate,
            category: draft.category,
            content: draft.content,
          });
          forgetDraft(draft.localDate, draft.category);
          recovered.push(record);
        }
        if (!cancelled && recovered.length > 0) {
          for (const record of recovered) replaceRecord(record);
        }
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            loading: false,
            loadError: errorMessage(error),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, replaceRecord]);

  const setCompleted = useCallback(
    async (localDate: LocalDate, category: Category, completed: boolean) => {
      const key = saveKey(localDate, category);
      markSaveState(key, 'saving');
      try {
        // `content` is omitted on purpose: ticking or unticking must never
        // touch text the user already wrote.
        const record = await repo.upsertDailyRecord({ localDate, category, completed });
        replaceRecord(record);
        markSaveState(key, 'saved');
      } catch {
        markSaveState(key, 'error');
      }
    },
    [markSaveState, replaceRecord, repo],
  );

  const setContent = useCallback(
    async (localDate: LocalDate, category: Category, content: string) => {
      const key = saveKey(localDate, category);
      markSaveState(key, 'saving');
      try {
        // `completed` is omitted on purpose: typing must not auto-complete.
        const record = await repo.upsertDailyRecord({ localDate, category, content });
        replaceRecord(record);
        forgetDraft(localDate, category);
        markSaveState(key, 'saved');
      } catch {
        // Keep the draft buffered so the text can be retried, never discarded.
        markSaveState(key, 'error');
      }
    },
    [markSaveState, replaceRecord, repo],
  );

  const noteTyping = useCallback((localDate: LocalDate, category: Category, content: string) => {
    rememberDraft({ localDate, category, content, typedAt: new Date().toISOString() });
  }, []);

  const addBook = useCallback(
    async (input: BookInput) => {
      const book = await repo.createBook(input);
      setState((previous) => ({ ...previous, books: [...previous.books, book] }));
      return book;
    },
    [repo],
  );

  const editBook = useCallback(
    async (id: string, patch: Partial<BookInput>) => {
      const book = await repo.updateBook(id, patch);
      setState((previous) => ({
        ...previous,
        books: previous.books.map((candidate) => (candidate.id === id ? book : candidate)),
      }));
    },
    [repo],
  );

  const removeBook = useCallback(
    async (id: string) => {
      await repo.deleteBook(id);
      setState((previous) => ({
        ...previous,
        books: previous.books.filter((candidate) => candidate.id !== id),
      }));
    },
    [repo],
  );

  const addReflection = useCallback(
    async (input: ReflectionInput) => {
      const reflection = await repo.createManualReflection(input);
      setState((previous) => ({
        ...previous,
        reflections: [...previous.reflections, reflection],
      }));
    },
    [repo],
  );

  const editReflection = useCallback(
    async (id: string, patch: Partial<ReflectionInput>) => {
      const reflection = await repo.updateManualReflection(id, patch);
      setState((previous) => ({
        ...previous,
        reflections: previous.reflections.map((candidate) =>
          candidate.id === id ? reflection : candidate,
        ),
      }));
    },
    [repo],
  );

  const removeReflection = useCallback(
    async (id: string) => {
      await repo.deleteReflection(id);
      setState((previous) => ({
        ...previous,
        reflections: previous.reflections.filter((candidate) => candidate.id !== id),
      }));
    },
    [repo],
  );

  const collectThinking = useCallback(
    async (localDate: LocalDate) => {
      const source = recordsRef.current.find(
        (record) => record.localDate === localDate && record.category === 'thinking',
      );
      if (!source || source.content.trim().length === 0) {
        throw new Error('请先写下今天的思考，再收藏到年度感悟');
      }
      const reflection = await repo.collectDailyReflection(source.id, localDate);
      setState((previous) =>
        previous.reflections.some((candidate) => candidate.id === reflection.id)
          ? previous
          : { ...previous, reflections: [...previous.reflections, reflection] },
      );
    },
    [repo],
  );

  const uncollectThinking = useCallback(
    async (localDate: LocalDate) => {
      const source = recordsRef.current.find(
        (record) => record.localDate === localDate && record.category === 'thinking',
      );
      if (!source) return;
      // Removes the yearly collection only — the daily record is untouched.
      await repo.removeDailyReflection(source.id);
      setState((previous) => ({
        ...previous,
        reflections: previous.reflections.filter(
          (candidate) => candidate.sourceDailyRecordId !== source.id,
        ),
      }));
    },
    [repo],
  );

  const persistReview = useCallback(
    async (input: ReviewInput) => {
      const review = await repo.saveReview(input);
      setState((previous) => {
        const position = previous.reviews.findIndex((candidate) => candidate.id === review.id);
        return {
          ...previous,
          reviews:
            position === -1
              ? [...previous.reviews, review]
              : previous.reviews.map((candidate, index) =>
                  index === position ? review : candidate,
                ),
        };
      });
    },
    [repo],
  );

  const exportBackup = useCallback(() => repo.exportBackup(), [repo]);

  const importBackup = useCallback(
    async (backup: BackupFile, mode: 'replace' | 'merge') => {
      await repo.importBackup(backup, mode);
      const [records, books, reflections, reviews] = await Promise.all([
        repo.listDailyRecords(),
        repo.listBooks(),
        repo.listReflections(),
        repo.listReviews(),
      ]);
      setState({ loading: false, loadError: null, records, books, reflections, reviews });
    },
    [repo],
  );

  const value = useMemo<GrowthStoreValue>(
    () => ({
      ...state,
      saveStates,
      setCompleted,
      setContent,
      noteTyping,
      addBook,
      editBook,
      removeBook,
      addReflection,
      editReflection,
      removeReflection,
      collectThinking,
      uncollectThinking,
      persistReview,
      exportBackup,
      importBackup,
    }),
    [
      state,
      saveStates,
      setCompleted,
      setContent,
      noteTyping,
      addBook,
      editBook,
      removeBook,
      addReflection,
      editReflection,
      removeReflection,
      collectThinking,
      uncollectThinking,
      persistReview,
      exportBackup,
      importBackup,
    ],
  );

  return <GrowthStoreContext.Provider value={value}>{children}</GrowthStoreContext.Provider>;
}

export function useGrowthStore(): GrowthStoreValue {
  const value = useContext(GrowthStoreContext);
  if (!value) throw new Error('useGrowthStore must be used inside GrowthStoreProvider');
  return value;
}
