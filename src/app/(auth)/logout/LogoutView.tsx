'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Spinner } from '@/components/general/spinner';
import { errorMessageOf } from '@/components/general/query-state';
import { clearClientSession } from '@/helpers/session';
import { useCustomToast } from '@/hooks/useCustomToast';
import { useLogout } from '@/services/auth.services';
import { useAuthStore, waitForHydration } from '@/store/auth.store';

/**
 * Signing out is a page rather than a menu handler because it is a sequence with
 * a required order, and half of it must survive a failure:
 *
 * 1. **Tell the server.** `POST auth/logout` revokes the refresh row and writes
 *    the audit entry. This has to happen *first* — it needs the access token the
 *    next step destroys.
 * 2. **Tear down the client.** Zustand, the persisted `localStorage` record,
 *    `sessionStorage` and the query cache all go (`clearClientSession`).
 * 3. **Leave for `/`.**
 *
 * Step 2 runs even when step 1 fails. A server that can't be reached is no
 * reason to leave a live token sitting in `localStorage` on what might be a
 * shared machine — but the operator is told, because the session may still be
 * open server-side.
 *
 * `?scope=all` revokes every session on the account instead of just this one.
 */
export function LogoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useCustomToast();

  const logout = useLogout();

  /**
   * Guards the sequence to a single run. Load-bearing in development, where
   * Strict Mode mounts effects twice — and a replayed refresh token revokes the
   * whole family, so the second call would 401 on a session already gone.
   */
  const startedRef = useRef(false);

  const allDevices = searchParams.get('scope') === 'all';

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      // The token lives in `localStorage`, so there is nothing to send until the
      // store has rehydrated.
      await waitForHydration();

      // No session — an operator who hit this URL directly, or a second tab
      // that already signed out. Nothing to revoke; still clear and leave.
      if (useAuthStore.getState().access?.token) {
        try {
          await logout.mutateAsync({ allDevices });
        } catch (error) {
          showToast({
            title: 'Signed out on this device only',
            description: errorMessageOf(
              error,
              "The server couldn't be reached, so the session may still be open elsewhere.",
            ),
            type: 'warning',
            duration: 8000,
          });
        }
      }

      clearClientSession();

      // `replace`, so Back can't return to a page that has already run its
      // teardown and would just bounce again.
      router.replace('/');
    })();
  }, [allDevices, logout, router, showToast]);

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <Spinner size="lg" label="Signing out" />
      <div className="space-y-1.5">
        <h2 className="font-display text-base font-semibold">Signing you out</h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          {allDevices
            ? 'Ending every session on this account and clearing this device.'
            : 'Ending this session and clearing it from this device.'}
        </p>
      </div>
    </div>
  );
}
