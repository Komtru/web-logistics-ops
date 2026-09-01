import { useMutation, useQuery } from '@tanstack/react-query';

import type {
  AuthEnvelope,
  OperatorAccount,
  OperatorProfile,
  UpdateOperatorProfilePayload,
} from '@/interfaces/auth';
import type { RequestError } from '@/interfaces/IAxios';
import { http } from '@/services/base';
import { useAuthStore } from '@/store/auth.store';

/**
 * The operator's own account.
 *
 * A STAFF-scoped surface of its own (`admin/me`) rather than the consumer `me/`, and not by preference —
 * neither existing endpoint can answer "who am I" for an operator:
 *
 * - `GET me/` applies `scope: 'CONSUMER'` at the router, so a staff token gets
 *   `403 This endpoint requires a consumer session.`
 * - `GET admin/staff/:id` goes through `assertAdminAction`, which refuses self-dealing — so it 403s
 *   your *own* id specifically.
 *
 * Which is why the console used to render entirely from whatever the login response said, held in
 * `localStorage`, until the operator happened to sign out.
 */
export const accountKeys = {
  all: ['account'] as const,
  me: () => [...accountKeys.all, 'me'] as const,
};

/**
 * Reads the account, and mirrors what comes back into the session store.
 *
 * The write sits inside `queryFn` because React Query v5 removed `onSuccess` from `useQuery` — a
 * side-effecting `useEffect` on `data` would be the alternative, and it would run per consumer rather
 * than per fetch. One fetch, one write.
 *
 * `staleTime: 0` overrides the app's 30s default deliberately: the point of this query is to be right
 * about the session on every page load, and a load served from a stale cache is exactly the case it
 * exists to catch.
 */
export function useOperatorAccount({ enabled = true }: { enabled?: boolean } = {}) {
  const syncOperatorAccount = useAuthStore((state) => state.syncOperatorAccount);

  return useQuery<OperatorAccount, RequestError>({
    queryKey: accountKeys.me(),
    enabled,
    staleTime: 0,
    /**
     * No retry. The two failures that matter are both terminal: a 401 means the session is gone (and
     * `services/base.ts` has already tried a refresh and hard-redirected), and a 403 means the token
     * cannot reach this route at all. Retrying either just delays the sign-out.
     */
    retry: false,
    queryFn: async () => {
      const response = await http.get<AuthEnvelope<OperatorAccount>>({ url: 'admin/me' });

      syncOperatorAccount(response.data);

      return response.data;
    },
  });
}

/**
 * Saves a display name, a photo, or both.
 *
 * Writes the response into the store rather than invalidating and re-reading: the API answers with the
 * same `profile` block `admin/me` returns, precisely so the round trip isn't needed. `setProfile` and
 * not `syncOperatorAccount`, because a profile edit must not overwrite roles — those come from a
 * different source and could only be stale here.
 */
export function useUpdateOperatorProfile() {
  const setProfile = useAuthStore((state) => state.setProfile);

  return useMutation<OperatorProfile, RequestError, UpdateOperatorProfilePayload>({
    mutationKey: [...accountKeys.me(), 'update'],
    mutationFn: async (body) => {
      const response = await http.patch<AuthEnvelope<OperatorProfile>>({
        url: 'admin/me/profile',
        body,
      });

      return response.data;
    },
    onSuccess: (profile) => setProfile(profile),
  });
}
