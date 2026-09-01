'use client';

import { useEffect, useState } from 'react';

import { initialsOf } from '@/helpers/format';
import { cn } from '@/lib/utils';

interface OperatorAvatarProps {
  /** What to derive initials from when there is no photo — see `operatorLabel`. */
  label: string | null;
  /** A resolved, ready-to-render URL, or `null` for no photo. */
  avatarUrl?: string | null;
  className?: string;
}

/**
 * The operator's face, in one place.
 *
 * A photo when there is one, initials when there isn't — and initials are a genuine state, not a
 * placeholder: `displayName` and a profile photo are both optional, and an operator who never set
 * either is correctly rendered as two letters forever.
 *
 * A plain `<img>` rather than `next/image`, deliberately. The URL is a signed Cloudinary delivery URL
 * whose host is not in `next.config.ts`'s `remotePatterns`, and there is nothing for the optimizer to
 * win on a 32px circle it would have to proxy — while adding the host would let *any* signed URL from
 * that account through the optimizer.
 */
export function OperatorAvatar({ label, avatarUrl, className }: OperatorAvatarProps) {
  /**
   * A photo that fails to load falls back to initials rather than to a broken-image glyph.
   *
   * Reachable in ordinary use: a tombstoned file, or an avatar persisted in `localStorage` whose
   * underlying file has since been removed. Keyed on the URL so a *new* photo gets a fresh attempt
   * instead of inheriting the last one's failure.
   */
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [avatarUrl]);

  // `className` LAST in every branch, not folded into a shared prefix. tailwind-merge resolves
  // conflicts by position, so a caller asking for `size-16 text-lg` has to come after the defaults —
  // otherwise the large avatar renders with 11px initials inside it.
  const shell = 'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full';

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        className={cn(shell, 'bg-secondary object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        shell,
        'bg-komtru-blue-soft text-komtru-info-on-soft dark:bg-komtru-blue/25 dark:text-komtru-slate-100 text-[11px] font-semibold',
        className,
      )}
      aria-hidden
    >
      {initialsOf(label)}
    </span>
  );
}
