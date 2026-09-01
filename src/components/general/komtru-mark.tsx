import { cn } from '@/lib/utils';

interface KomtruMarkProps {
  className?: string;
  /** Diameter of the glyph in px. */
  size?: number;
}

/**
 * The Komtru mark: two counterparties joined through a single verified node.
 * Inline SVG so it inherits `currentColor` and needs no network request.
 */
export function KomtruMark({ className, size = 18 }: KomtruMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8 11l8-4M8 13l8 4" />
    </svg>
  );
}

export function KomtruWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display inline-flex items-center gap-2 font-semibold', className)}>
      <KomtruMark className="text-komtru-cyan" />
      Komtru
    </span>
  );
}
