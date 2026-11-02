import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category } from '../domain/types';
import type { LocalDate } from '../domain/dates';
import { useGrowthStore } from '../store/GrowthStore';

const DEBOUNCE_MS = 500;

/**
 * Autosaving text field for one date + dimension.
 *
 * Typing goes into the crash buffer immediately and into IndexedDB 500ms later.
 * A pending edit is flushed when the date changes or the card unmounts, so
 * switching days cannot drop an unsaved sentence.
 */
export function useAutosaveText(localDate: LocalDate, category: Category, storedContent: string) {
  const { setContent, noteTyping } = useGrowthStore();
  const [draft, setDraft] = useState(storedContent);
  const draftRef = useRef(storedContent);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storedRef = useRef(storedContent);
  storedRef.current = storedContent;
  const setContentRef = useRef(setContent);
  setContentRef.current = setContent;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /**
   * Adopt the text of the current date + dimension, and on the way out flush
   * whatever was still pending for it. The cleanup closes over this identity,
   * so a pending edit is always written to the row it was typed into, never to
   * the row the user switched to.
   */
  useEffect(() => {
    setDraft(storedRef.current);
    draftRef.current = storedRef.current;
    dirtyRef.current = false;
    return () => {
      clearTimer();
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      void setContentRef.current(localDate, category, draftRef.current);
    };
  }, [localDate, category]);

  // Pick up external changes (draft recovery, backup import) while the field is
  // not being edited.
  useEffect(() => {
    if (dirtyRef.current) return;
    if (storedContent !== draftRef.current) {
      setDraft(storedContent);
      draftRef.current = storedContent;
    }
  }, [storedContent]);

  const flush = useCallback(() => {
    clearTimer();
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    void setContent(localDate, category, draftRef.current);
  }, [setContent, localDate, category]);

  const onChange = useCallback(
    (next: string) => {
      setDraft(next);
      draftRef.current = next;
      dirtyRef.current = true;
      noteTyping(localDate, category, next);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        void setContent(localDate, category, draftRef.current);
      }, DEBOUNCE_MS);
    },
    [noteTyping, setContent, localDate, category],
  );

  return { draft, onChange, flush };
}
