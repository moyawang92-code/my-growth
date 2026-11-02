import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { X } from 'lucide-react';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'rounded-[var(--radius-card)] border border-line bg-surface shadow-[0_1px_2px_rgba(51,48,44,0.03)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-sage-500 text-white hover:bg-sage-600 disabled:bg-sage-200',
  ghost:
    'border border-line-strong bg-surface text-ink hover:border-sage-300 hover:text-sage-600 disabled:text-ink-faint',
  quiet: 'text-ink-soft hover:bg-sage-50 hover:text-sage-600 disabled:text-ink-faint',
  danger: 'border border-[#e3c9c3] bg-surface text-[#a8503f] hover:bg-[#fdf3f1]',
};

export function Button({
  variant = 'ghost',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sage-50 hover:text-sage-600 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Textarea that grows with its content instead of scrolling internally. */
export function AutoGrowTextarea({
  value,
  minRows = 2,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={cx(
        'w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none',
        className,
      )}
      {...rest}
    />
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(51,48,44,0.28)] p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <IconButton label="关闭" onClick={onClose} className="-mt-1 -mr-1">
            <X size={18} />
          </IconButton>
        </div>
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-sage-300 focus:outline-none';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-faint">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-faint">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
