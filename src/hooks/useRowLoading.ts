'use client';

import { useCallback, useState } from 'react';

/**
 * Per-row pending state for tables, so one row's action doesn't spin every
 * other row's button.
 */
export function useRowLoading<Id extends string = string>() {
  const [loadingRows, setLoadingRows] = useState<Set<Id>>(new Set());

  const startLoading = useCallback((id: Id) => {
    setLoadingRows((previous) => new Set(previous).add(id));
  }, []);

  const stopLoading = useCallback((id: Id) => {
    setLoadingRows((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const isRowLoading = useCallback((id: Id) => loadingRows.has(id), [loadingRows]);

  const withRowLoading = useCallback(
    async <T>(id: Id, action: () => Promise<T>): Promise<T> => {
      startLoading(id);
      try {
        return await action();
      } finally {
        stopLoading(id);
      }
    },
    [startLoading, stopLoading],
  );

  return { isRowLoading, startLoading, stopLoading, withRowLoading };
}
