import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { SaveState } from '../store/GrowthStore';
import { Button } from './ui';

export function SaveIndicator({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry?: () => void;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {state === 'idle' ? null : (
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.18 }}
          className="inline-flex items-center gap-1 text-xs"
          role="status"
          aria-live="polite"
        >
          {state === 'saving' ? (
            <span className="inline-flex items-center gap-1 text-ink-faint">
              <Loader2 size={13} className="animate-spin" />
              保存中
            </span>
          ) : null}
          {state === 'saved' ? (
            <span className="inline-flex items-center gap-1 text-sage-500">
              <Check size={13} />
              已保存
            </span>
          ) : null}
          {state === 'error' ? (
            <span className="inline-flex items-center gap-1.5 text-[#a8503f]">
              <AlertCircle size={13} />
              保存失败
              {onRetry ? (
                <Button
                  variant="quiet"
                  onClick={onRetry}
                  className="h-auto px-1.5 py-0 text-xs text-[#a8503f] underline hover:bg-transparent"
                >
                  重试
                </Button>
              ) : null}
            </span>
          ) : null}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
