import { cx } from './ui';

/**
 * Placeholder cover for books without an uploaded image.
 *
 * It is deliberately a typographic panel derived from the title, never a
 * fetched or invented artwork, so no book is shown with a cover that is not
 * really its own.
 */
const PALETTES = [
  'from-sage-200 to-sage-100 text-sage-600',
  'from-gold-100 to-[#f3e7cf] text-gold-500',
  'from-[#e6e2dc] to-[#f2efe9] text-ink-soft',
  'from-[#dfe6e3] to-[#eef2f0] text-[#4f7268]',
  'from-[#e9e1e4] to-[#f5eff1] text-[#7c5c66]',
];

function paletteFor(title: string): string {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) % 9973;
  }
  return PALETTES[hash % PALETTES.length];
}

export function BookCover({
  title,
  coverUrl,
  className,
}: {
  title: string;
  coverUrl?: string;
  className?: string;
}) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={`《${title}》封面`}
        className={cx('h-full w-full rounded-lg object-cover', className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`《${title}》占位封面`}
      className={cx(
        'flex h-full w-full items-end rounded-lg bg-gradient-to-br p-2.5',
        paletteFor(title),
        className,
      )}
    >
      <span className="line-clamp-4 text-[13px] leading-snug font-medium break-all">{title}</span>
    </div>
  );
}
