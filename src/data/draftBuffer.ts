import type { Category } from '../domain/types';
import type { LocalDate } from '../domain/dates';

/**
 * Crash buffer for text that has been typed but not yet written to IndexedDB.
 *
 * IndexedDB remains the real store; this only covers the gap between a
 * keystroke and the debounced write (e.g. the user reloads mid-sentence).
 * Entries are cleared as soon as the durable write confirms.
 */
const STORAGE_KEY = 'my-growth:pending-drafts:v1';

export interface PendingDraft {
  localDate: LocalDate;
  category: Category;
  content: string;
  typedAt: string;
}

type DraftMap = Record<string, PendingDraft>;

export function draftKey(localDate: LocalDate, category: Category): string {
  return `${localDate}::${category}`;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Private-mode browsers can throw on access.
    return null;
  }
}

function readAll(): DraftMap {
  const storage = safeStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(drafts: DraftMap): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (Object.keys(drafts).length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // A full or unavailable quota must not break typing.
  }
}

export function rememberDraft(draft: PendingDraft): void {
  const drafts = readAll();
  drafts[draftKey(draft.localDate, draft.category)] = draft;
  writeAll(drafts);
}

export function forgetDraft(localDate: LocalDate, category: Category): void {
  const drafts = readAll();
  delete drafts[draftKey(localDate, category)];
  writeAll(drafts);
}

export function listPendingDrafts(): PendingDraft[] {
  return Object.values(readAll());
}

export function clearAllDrafts(): void {
  writeAll({});
}
