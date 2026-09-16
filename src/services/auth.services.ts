import { useMutation } from '@tanstack/react-query';

import type {
  ActivatedFactor,
  AuthAck,
  AuthEnvelope,
  LogisticsLoginPayload,
  LogisticsSession,
  LogoutPayload,
  MfaVerifyPayload,
  OtpRequestPayload,
  OtpVerifyPayload,
  StaffAccess,
  StaffLoginResponse,
  StaffSession,
  TotpActivatePayload,
  TotpEnrolment,
  TotpEnrolPayload,
} from '@/interfaces/auth';
import type { RequestError } from '@/interfaces/IAxios';
import { isMfaChallenge, toAccess } from '@/helpers/session';
import { http } from '@/services/base';
import { useAuthStore } from '@/store/auth.store';

/**
 * Staff email-OTP sign-in.
 *
 * Both calls are passwordless and neither is tenant-scoped. Failures come back
 * as a uniform 401 (`Invalid credentials.`) whatever went wrong — unknown
 * address, non-staff account, wrong/expired/spent code — so there is nothing to
 * branch on and nothing more specific to tell the operator.
 */
export const authKeys = {
  all: ['auth'] as const,
  otp: () => [...authKeys.all, 'otp'] as const,
  logistics: () => [...authKeys.all, 'logistics'] as const,
  logout: () => [...authKeys.all, 'logout'] as const,
  totp: () => [...authKeys.all, 'totp'] as const,
};

/**
 * Step 1 — mail a code to the operator.
 *
 * Always resolves 202 with a bare acknowledgement: identical for a real
 * operator, a consumer, an unknown address and a throttled one. Success here
 * therefore means "the request was accepted", *not* "an email was sent" — so
 * never surface it as confirmation that the address exists.
 *
 * Rate limits (invisible in the response): 5/min per address, 20/min per IP.
 */
export function useRequestOtp() {
  return useMutation<AuthAck, RequestError, OtpRequestPayload>({
    mutationKey: [...authKeys.otp(), 'request'],
    mutationFn: (body) =>
      http.post<AuthAck>({
        url: 'auth/staff/login/request',
        body,
      }),
  });
}

/**
 * Step 2 — redeem the code.
 *
 * Answers 200 two ways: a session, or an MFA challenge when the account has an
 * active factor. Only the former is committed to the store; the caller branches
 * on the result with `isMfaChallenge`.
 *
 * Two things a session doesn't carry, and what happens to them:
 * - **email** — taken from the submitted `variables`; the response omits it and
 *   the console needs it to label the session.
 * - **organization** — staff sign-in is tenant-agnostic, so the store keeps
 *   `organization: null` rather than inventing one.
 */
export function useVerifyOtp() {
  const initUserStore = useAuthStore((state) => state.initUserStore);

  return useMutation<StaffLoginResponse, RequestError, OtpVerifyPayload>({
    mutationKey: [...authKeys.otp(), 'verify'],
    mutationFn: async (body) => {
      const response = await http.post<AuthEnvelope<StaffLoginResponse>>({
        url: 'auth/staff/login/verify',
        body: { platform: 'WEB', ...body },
      });
      return response.data;
    },
    onSuccess: (result, variables) => {
      if (isMfaChallenge(result)) return;

      initUserStore({
        auth: { id: result.user.userId, email: variables.email },
        user: result.user,
        staff: result.staff ?? null,
        tokens: toAccess(result),
      });
    },
  });
}

/**
 * Redeems an MFA challenge for a session.
 *
 * Takes `email` alongside the API fields for the same reason `useVerifyOtp`
 * does — the response omits it and the console needs it to label the session —
 * and strips it before the request, since the API neither wants nor accepts it.
 *
 * One-shot by construction: the service consumes `mfaToken` with an atomic
 * GETDEL *before* checking the code, so any rejection — wrong code, expired
 * token, replayed token — leaves nothing to retry. Callers must treat an error
 * as "this challenge is gone", not "try again".
 */
export function useVerifyMfa() {
  const initUserStore = useAuthStore((state) => state.initUserStore);

  return useMutation<StaffSession, RequestError, MfaVerifyPayload & { email: string }>({
    mutationKey: [...authKeys.all, 'mfa', 'verify'],
    mutationFn: async ({ email: _email, ...body }) => {
      const response = await http.post<AuthEnvelope<StaffLoginResponse>>({
        url: 'auth/mfa/verify',
        body,
      });

      // `completeMfaLogin` only ever answers with a session. A challenge here
      // would mean a further factor the console has no screen for, so surface it
      // rather than committing a half-authenticated state.
      if (isMfaChallenge(response.data)) {
        throw {
          status: false,
          message: 'This account needs a further factor the console cannot verify.',
        } satisfies RequestError;
      }

      return response.data;
    },
    onSuccess: (result, variables) => {
      initUserStore({
        auth: { id: result.user.userId, email: variables.email },
        user: result.user,
        staff: result.staff ?? null,
        tokens: toAccess(result),
      });
    },
  });
}

/**
 * `GET /admin/me` — the operator reading their own account, resolved fresh
 * (never from the token). Modelled as a mutation rather than a query: the
 * one caller today (`InvitationAcceptForm`, after `useAcceptInvitation`
 * succeeds) needs it as a one-off, imperative fetch to run right after
 * acceptance commits a session, not as a cached, re-rendered query.
 *
 * That caller exists because of a real gap in the invitation-accept
 * response: unlike `auth/staff/login/verify`, it carries no `staff` block
 * (see `docs/api/staff-invitations.md` in `backend-apis` — the accept
 * response is `{ accessToken, refreshToken, expiresIn, tokenType, user,
 * roleCode, nextStep }`, nothing more). Without this follow-up call, a
 * freshly accepted admin would land in the console with `staff: null` and
 * `config/menu.tsx` would filter their sidebar down to nothing.
 */
export function useAdminMe() {
  return useMutation<{ staff: StaffAccess }, RequestError, void>({
    mutationKey: [...authKeys.all, 'me'],
    mutationFn: async () => {
      const response = await http.get<AuthEnvelope<{ staff: StaffAccess }>>({ url: 'admin/me' });
      return response.data;
    },
  });
}

/**
 * Step 1 of enrolment — mint a PENDING TOTP factor.
 *
 * The response carries the seed, and this is the **only** time any endpoint
 * returns it (encrypted at rest, never read back), so the caller has to hold it
 * until activation succeeds rather than refetching. A PENDING factor satisfies
 * no login, so an abandoned enrolment leaves the account exactly as it was.
 */
export function useEnrolTotp() {
  return useMutation<TotpEnrolment, RequestError, TotpEnrolPayload | void>({
    mutationKey: [...authKeys.totp(), 'enrol'],
    mutationFn: async (payload) => {
      const response = await http.post<AuthEnvelope<TotpEnrolment>>({
        url: 'me/mfa/totp/enroll',
        body: { label: payload?.label ?? 'Authenticator app' },
      });
      return response.data;
    },
  });
}

/**
 * Step 2 — prove the authenticator stored the seed, activating the factor.
 *
 * Nothing in the session changes: the operator is already signed in, and the
 * factor takes effect from the *next* sign-in. So there is no token to swap and
 * nothing to write to the store.
 */
export function useActivateTotp() {
  return useMutation<ActivatedFactor, RequestError, TotpActivatePayload>({
    mutationKey: [...authKeys.totp(), 'activate'],
    mutationFn: async (body) => {
      const response = await http.post<AuthEnvelope<ActivatedFactor>>({
        url: 'me/mfa/totp/activate',
        body,
      });
      return response.data;
    },
  });
}

/**
 * Logistics identifier+password sign-in.
 *
 * Single step, unlike Staff's two-step OTP flow — `POST auth/logistics/login`
 * verifies credentials and issues a session in one call (mirrors
 * `POST auth/staff/login`'s structure server-side per the M2 spec, §2 — same
 * credential-verification logic — but this console's Staff flow is OTP while
 * Logistics is password).
 *
 * The eligibility check happens after credentials check out: the caller
 * needs an active row in `logistics_company_members`, or the request 403s
 * with `errorCode: 'NO_LOGISTICS_ACCESS'` — the credentials can be entirely
 * valid for the person's regular Kumtru account, this is specifically about
 * portal eligibility, not identity. Callers branch on `error.errorCode`, not
 * `error.message`, to detect it.
 *
 * This screen also doubles as the invitation-acceptance screen (M2 spec
 * §2/§8): there is no separate accept step or token — a first successful
 * login for an INVITED member is what activates them server-side. Nothing
 * client-side has to know or handle that; it's transparent to this hook.
 */
export function useLogisticsLogin() {
  const initLogisticsStore = useAuthStore((state) => state.initLogisticsStore);

  return useMutation<LogisticsSession, RequestError, LogisticsLoginPayload>({
    mutationKey: [...authKeys.logistics(), 'login'],
    mutationFn: async (body) => {
      const response = await http.post<AuthEnvelope<LogisticsSession>>({
        url: 'auth/logistics/login',
        body: { platform: 'WEB', ...body },
      });
      return response.data;
    },
    onSuccess: (result, variables) => {
      initLogisticsStore({
        auth: { id: result.user.userId, email: variables.identifier },
        user: result.user,
        logistics: result.logistics,
        tokens: toAccess(result),
      });
    },
  });
}

/**
 * Ends the session server-side: revokes the refresh row and writes a `LOGOUT`
 * audit entry.
 *
 * Reads the refresh token off the store rather than taking it as an argument,
 * so no caller has to know the session shape. Answers **204** — hence `void`.
 *
 * Deliberately does *not* touch client state on success. Signing out has to
 * clear regardless of what the API says (a 401 from a session the server has
 * already killed must still get the operator out), so ordering that teardown is
 * the caller's job — see `app/(auth)/logout/LogoutView.tsx`.
 */
export function useLogout() {
  return useMutation<void, RequestError, Pick<LogoutPayload, 'allDevices'> | void>({
    mutationKey: authKeys.logout(),
    mutationFn: (payload) =>
      http.post<void>({
        url: 'auth/logout',
        body: {
          refreshToken: useAuthStore.getState().refresh?.token,
          allDevices: payload?.allDevices ?? false,
        },
      }),
  });
}
