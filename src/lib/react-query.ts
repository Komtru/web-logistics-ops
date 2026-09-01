import { QueryClient } from '@tanstack/react-query';

let client: QueryClient | undefined;

/**
 * Lazily-created module singleton. Server renders get a fresh client per call
 * site only if one has not been created yet in this module instance; the
 * browser reuses the same client for the lifetime of the tab.
 */
export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
  }

  return client;
}
