import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  /** Announced to screen readers; also rendered next to the glyph when `showLabel`. */
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'size-3.5',
  md: 'size-5',
  lg: 'size-7',
} as const;

export function Spinner({ className, label = 'Loading', showLabel, size = 'md' }: SpinnerProps) {
  return (
    <span className={cn('text-muted-foreground inline-flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin', sizeMap[size])} aria-hidden />
      <span className={showLabel ? 'text-sm' : 'sr-only'}>{label}</span>
    </span>
  );
}
