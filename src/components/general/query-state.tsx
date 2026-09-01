'use client';

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Spinner } from '@/components/general/spinner';
import { Button } from '@/components/ui/button';
import type { RequestError } from '@/interfaces/IAxios';
import { cn } from '@/lib/utils';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  loadingLabel?: string;
  children: ReactNode;
  className?: string;
}

/** Reads `message` off the API error envelope, with a safe fallback. */
export function errorMessageOf(error: unknown, fallback = 'Something went wrong.'): string {
  if (typeof error === 'string') return error;

  const envelope = error as Partial<RequestError> | null;
  return envelope?.message ?? fallback;
}

/**
 * One place for the loading / error / empty triad, so every screen behaves the
 * same way when the API is unreachable.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  loadingLabel = 'Loading',
  children,
  className,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className={cn('flex min-h-40 items-center justify-center', className)}>
        <Spinner label={loadingLabel} showLabel />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'border-komtru-risk/30 bg-komtru-risk-soft dark:bg-komtru-risk/10 flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center',
          className,
        )}
        role="alert"
      >
        <AlertTriangle className="text-komtru-risk size-5" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Couldn&apos;t load this</p>
          <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
            {errorMessageOf(error)}
          </p>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          'border-border flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center',
          className,
        )}
      >
        <Inbox className="text-muted-foreground size-5" aria-hidden />
        <p className="text-sm font-semibold">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
            {emptyDescription}
          </p>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
