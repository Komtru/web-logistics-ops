'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { clearClientSession, isOperableStatus } from '@/helpers/session';
import { useOperatorAccount } from '@/services/account.services';

/**
 * Where an account that is no longer operable lands, and why it left.
 *
 * A distinct reason from `session_expired`: that one means "your session ran out, sign in again", which
 * would be actively misleading here. This operator's session was fine — their account was changed.
 */
const INACTIVE_REASON = 'account_inactive';

/**
 * Re-reads the operator's account on every page load, and signs them out if it no longer checks out.
 *
 * The problem it solves: the session lives in `localStorage`, so without a read like this the console
 * renders from whatever the login response said — for as long as the operator stays signed in. An
 * account downgraded, or a role granted, on Tuesday is invisible until they next sign out.
 *
 * Two outcomes, and the split matters:
 *
 * - **`status !== 'ACTIVE'`** → clear the session and leave. This catches `RESTRICTED` and
 *   `PENDING_VERIFICATION`, which keep a live session server-side. It is the only case this hook itself
 *   has to act on.
 * - **anything that actually revoked access** — suspension, closure, a revoked staff role — never
 *   reaches here as a status at all. All of them bump `sessions_epoch` and revoke every session, so the
 *   request is a 401 and `services/base.ts` has already refreshed once, failed, and ejected before this
 *   hook sees a result.
 *
 * A plain error is deliberately left alone. The API being unreachable is not evidence about anyone's
 * account, and signing an operator out mid-shift over a dropped connection would be the worse failure.
 * The persisted session keeps working and the next load tries again.
 */
export function useSessionSync({ enabled }: { enabled: boolean }): void {
  const router = useRouter();
  const { data } = useOperatorAccount({ enabled });

  const operable = isOperableStatus(data?.status);

  useEffect(() => {
    if (operable) return;

    /**
     * Clear before navigating, in that order.
     *
     * The sign-in page bounces anyone holding a token straight back into the console, so leaving the
     * session in place would ping-pong the operator between the two.
     *
     * And no `auth/logout` call on the way: the token is still valid, but this is the console ejecting
     * someone rather than the operator choosing to leave — there is no session the *server* wants
     * revoked, and a request that could hang has no business standing between this and the exit.
     */
    clearClientSession();
    router.replace(`/?reason=${INACTIVE_REASON}`);
  }, [operable, router]);
}
