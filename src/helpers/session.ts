import type {
  Access,
  IAuth,
  IUser,
  MfaChallenge,
  MfaFactor,
  OperatorProfile,
  StaffLoginNextStep,
  StaffLoginResponse,
  StaffStatus,
} from '@/interfaces/auth';
import type { ISODateString } from '@/interfaces/common';
import { getQueryClient } from '@/lib/react-query';
import { AUTH_STORAGE_KEY, useAuthStore } from '@/store/auth.store';

/**
 * The flat token trio the identity service returns. Both `auth/staff/login/verify`
 * and the refresh endpoint answer in this shape, so the mapping below is shared
 * rather than duplicated in `services/base.ts`.
 */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn?: number;
}

/** Relative lifetime → absolute instant, so a stored token stays comparable. */
export function expiryFrom(seconds: number): ISODateString {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Flat API tokens → the nested `{ access, refresh }` pair the store and the
 * `Bearer` interceptor hold.
 *
 * Only the access token gets an expiry; the refresh token comes back as a bare
 * opaque string with no stated lifetime.
 */
export function toAccess(tokens: IssuedTokens): Access {
  return {
    access: {
      token: tokens.accessToken,
      expires: tokens.expiresIn ? expiryFrom(tokens.expiresIn) : undefined,
    },
    refresh: { token: tokens.refreshToken },
  };
}

/**
 * Step 2 answers 200 for both outcomes, so the body's shape is the only signal:
 * a session carries tokens, a challenge carries `mfaRequired`.
 */
export function isMfaChallenge(response: StaffLoginResponse): response is MfaChallenge {
  return 'mfaRequired' in response && response.mfaRequired;
}

/**
 * Whether the issued session needs nothing further from the operator.
 *
 * `null` means done. A `nextStep` means the tokens work but something is still
 * outstanding — `ENROL_MFA` for an account flagged `mfa_required` with no active
 * factor, which is every bootstrap administrator on first sign-in.
 */
export function isSignInComplete(nextStep: StaffLoginNextStep | null | undefined): boolean {
  return !nextStep;
}

/**
 * How the console labels the signed-in operator.
 *
 * Display-name, then username, then email — in decreasing order of how much the operator chose it.
 * `displayName` is the one they typed on the Settings page and is usually the only human name in the
 * chain: a staff record's `username` is very often null, leaving the email as the fallback.
 *
 * `profile` is `null` until `admin/me` has been read once (the login response carries no profile), so
 * the first paint after a fresh sign-in falls through to the username or email and settles a moment
 * later. That is a one-off per browser, not per page load — the profile is persisted.
 */
export function operatorLabel(
  user: IUser | null,
  auth: IAuth | null,
  profile?: OperatorProfile | null,
): string | null {
  return profile?.displayName ?? user?.username ?? auth?.email ?? null;
}

/**
 * Whether a refetched account means "get this person out of the console".
 *
 * `ACTIVE` is the only status that may operate the console, so anything else signs out. In practice
 * that means `RESTRICTED` or `PENDING_VERIFICATION`, and the reason is worth stating because it decides
 * whether this check is reachable at all: `SUSPENDED`, `LOCKED` and `CLOSED` each bump the account's
 * `sessions_epoch` and revoke every session server-side, so a request from one of those accounts is a
 * **401**, not a 200 carrying a status. The same is true of a revoked staff role, which calls
 * `revokeAllSessions({ scope: 'STAFF' })`.
 *
 * So the two halves cover the whole space and neither is redundant:
 * - access actually withdrawn → 401 → `services/base.ts` refreshes once, fails, and ejects.
 * - account downgraded but still holding a live session → this check.
 *
 * A missing status (mid-hydration, or a response shape that changed) is NOT treated as booted. Failing
 * closed here would sign an operator out over a field that never arrived, and the 401 path already
 * covers every case where access has genuinely been taken away.
 */
export function isOperableStatus(status: StaffStatus | undefined | null): boolean {
  return status === undefined || status === null || status === 'ACTIVE';
}

/**
 * Wipes every trace of the session this tab was holding.
 *
 * Three stores, because clearing one is not enough:
 * - **Zustand** — `logoutAccount()` nulls the fields.
 * - **`localStorage`** — `persist` immediately writes that nulled shape back, so
 *   the record has to be *removed*, not emptied. Only the auth key goes; a blunt
 *   `localStorage.clear()` would also take the operator's theme choice.
 * - **TanStack Query** — cached module data belongs to the operator who fetched
 *   it. Leaving it would show the next sign-in the previous one's rows.
 *
 * Deliberately does not navigate: the caller decides where to land, and the API
 * call has to happen *before* the token is thrown away.
 */
export function clearClientSession(): void {
  useAuthStore.getState().logoutAccount();
  getQueryClient().clear();

  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.clear();
}

/**
 * Whether the outstanding step is one the console can actually complete, and so
 * should route to instead of merely announcing.
 *
 * Only `ENROL_MFA` qualifies. `CHOOSE_USERNAME` and `ADD_SECOND_CHANNEL` have no
 * screen — and neither gates access — so those stay a toast on the way through.
 */
export function requiresMfaEnrolment(nextStep: StaffLoginNextStep | null | undefined): boolean {
  return nextStep === 'ENROL_MFA';
}

/** Operator-facing copy for an outstanding `nextStep`. */
export function describeNextStep(nextStep: StaffLoginNextStep): string {
  switch (nextStep) {
    case 'ENROL_MFA':
      return 'Enrol an authenticator app to secure this account.';
    case 'CHOOSE_USERNAME':
      return 'Choose a username to finish setting up this account.';
    case 'ADD_SECOND_CHANNEL':
      return 'Add a second contact channel to this account.';
    case 'SET_PASSWORD':
      return 'Set a password for this account.';
    case 'CHANGE_PASSWORD':
      return 'This account is due a password change.';
    default:
      return 'This account needs another setup step.';
  }
}

/**
 * The factors from a challenge that the console can actually answer.
 *
 * `TOTP` only, and not by preference — the other three are each unusable for a
 * structural reason:
 * - `SMS_OTP` / `EMAIL_OTP` need a `challengeId`, and the endpoint that issues
 *   one has no route mounted, so no client can obtain it.
 * - `PASSKEY` needs a WebAuthn assertion ceremony, not a typed code.
 *
 * Recovery codes never appear here at all — the API filters `RECOVERY_CODE`
 * factors out of the list, so there is no `factorId` to submit one against.
 */
export function usableLoginFactors(factors: MfaFactor[]): MfaFactor[] {
  return factors.filter((factor) => factor.type === 'TOTP');
}

/** The factor to answer by default: the account's own choice, else the first. */
export function preferredFactor(factors: MfaFactor[]): MfaFactor | undefined {
  return factors.find((factor) => factor.isDefault) ?? factors[0];
}

/**
 * Whether the signed-in operator holds `permission`.
 *
 * Reads straight off the store rather than the token: `staff.permissions` is
 * resolved server-side at login from live role assignments (see M14's
 * `respondWithLogin`), so this is exactly what the backend would also decide —
 * never a client-side guess that can drift from what the API actually enforces.
 * A missing `staff` block (session mid-hydration, or somehow non-staff) denies
 * by default, matching the API's own posture.
 */
export function hasPermission(permission: string): boolean {
  return Boolean(useAuthStore.getState().staff?.permissions.includes(permission));
}

/** True when the operator holds at least one of `permissions`. */
export function hasAnyPermission(permissions: readonly string[]): boolean {
  const held = useAuthStore.getState().staff?.permissions ?? [];
  return permissions.some((permission) => held.includes(permission));
}
