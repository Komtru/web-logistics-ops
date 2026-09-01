import { DateTime } from 'luxon';

import type { ISODateString } from '@/interfaces/common';

/**
 * How long a new operator may defer enrolling an authenticator.
 *
 * Counted from account creation, not from first sign-in: the clock should not
 * restart because somebody was slow to log in for the first time.
 */
export const MFA_GRACE_DAYS = 90;

export interface MfaGrace {
  /** Whether "skip for now" is offered at all. */
  canSkip: boolean;
  /**
   * Whole days left in the window — rounded up, so the last partial day still
   * reads "1 day left" rather than "0".
   *
   * `null` when the account's age is unknown; the caller must not print a
   * countdown it cannot substantiate.
   */
  daysRemaining: number | null;
  /** When the window closes, or `null` when unknown. */
  closesOn: ISODateString | null;
}

/**
 * Whether enrolment can still be deferred, given when the account was created.
 *
 * **This is a nudge, not a control.** The API decides on its own terms: with
 * `IDENTITY_STAFF_REQUIRE_MFA=true` a factorless staff login is refused at
 * `auth/staff/login/verify` and never reaches this screen, and where the API
 * does issue a session it does not consult anything computed here. So the
 * window shapes what the console *asks for*, and cannot grant access the server
 * has refused.
 *
 * Unknown or unparseable `createdAt` fails **open** — skippable, but with no
 * countdown claimed. Failing closed would read better on paper and lock a
 * brand-new administrator out of the console the moment the field is missing,
 * which is precisely the account that has to get in to enrol at all.
 */
export function describeMfaGrace(createdAt?: ISODateString | null): MfaGrace {
  if (!createdAt) return { canSkip: true, daysRemaining: null, closesOn: null };

  const created = DateTime.fromISO(createdAt);
  if (!created.isValid) return { canSkip: true, daysRemaining: null, closesOn: null };

  const closes = created.plus({ days: MFA_GRACE_DAYS });
  const daysLeft = Math.ceil(closes.diffNow('days').days);

  return {
    canSkip: daysLeft > 0,
    daysRemaining: Math.max(daysLeft, 0),
    closesOn: closes.toISO() as ISODateString,
  };
}
