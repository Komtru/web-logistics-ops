import { useMutation, useQuery } from '@tanstack/react-query';

import type { AuthEnvelope } from '@/interfaces/auth';
import type {
  AcceptInvitationPayload,
  AcceptInvitationResult,
  InvitationPreview,
  RequestInvitationOtpResult,
} from '@/interfaces/invitation';
import type { RequestError } from '@/interfaces/IAxios';
import { toAccess } from '@/helpers/session';
import { http } from '@/services/base';
import { useAuthStore } from '@/store/auth.store';

/**
 * The invitee's half of staff-invitation acceptance — unauthenticated, the
 * token is the credential. Wired to identity's real endpoints under `/auth`
 * (`staffInvitation.service.ts`'s "Acceptance" section); request/response
 * shapes are quoted from `backend-apis/docs/api/staff-invitations.md`, not
 * guessed. See `app/(auth)/admin/invitations/accept/` for the page these
 * back — the URL segment matches exactly what the backend's own
 * `buildAcceptUrl` emails out (`{OAUTH_REDIRECT_BASE_URL}/admin/invitations/accept?token=`).
 */
export const invitationKeys = {
  all: ['staff-invitation-accept'] as const,
  preview: (token: string) => [...invitationKeys.all, 'preview', token] as const,
};

/** `GET /auth/staff/invitations/accept?token=` — reading changes and sends nothing. */
export function useInvitationPreview(token: string | undefined) {
  return useQuery<InvitationPreview>({
    queryKey: invitationKeys.preview(token ?? ''),
    enabled: Boolean(token),
    // The three failure statuses (invalid/claimed-or-cancelled/expired) are
    // each a real, distinct answer the page renders — not something to hide
    // behind a retry.
    retry: false,
    queryFn: async () => {
      const response = await http.get<AuthEnvelope<InvitationPreview>>({
        url: 'auth/staff/invitations/accept',
        query: { token },
      });
      return response.data;
    },
  });
}

/**
 * Step one — mail a code to the address named on the invitation. The API
 * never accepts a caller-supplied address; `token` is the only input.
 */
export function useRequestInvitationOtp() {
  return useMutation<RequestInvitationOtpResult, RequestError, { token: string }>({
    mutationKey: [...invitationKeys.all, 'request-otp'],
    mutationFn: async (body) => {
      const response = await http.post<AuthEnvelope<RequestInvitationOtpResult>>({
        url: 'auth/staff/invitations/request-otp',
        body,
      });
      return response.data;
    },
  });
}

/**
 * Step two — redeem the code. Creates (or promotes) the account, grants the
 * role, and issues a STAFF session, committed to the store the same way
 * `useVerifyOtp` commits a login.
 *
 * `maskedEmail` is not part of the API body — it never reaches the request —
 * it is what the page captured from step one's response, carried here only
 * so the store's `auth.email` label isn't left blank.
 *
 * One real gap versus a login response: this one carries no `staff`
 * (roles/permissions) block, so this commits `staff: null` and the caller
 * (`InvitationAcceptForm`) follows up with `useAdminMe()` to backfill it —
 * see the long comment on that hook in `auth.services.ts`.
 */
export function useAcceptInvitation() {
  const initUserStore = useAuthStore((state) => state.initUserStore);

  return useMutation<
    AcceptInvitationResult,
    RequestError,
    AcceptInvitationPayload & { maskedEmail: string }
  >({
    mutationKey: [...invitationKeys.all, 'accept'],
    mutationFn: async ({ maskedEmail: _maskedEmail, ...body }) => {
      const response = await http.post<AuthEnvelope<AcceptInvitationResult>>({
        url: 'auth/staff/invitations/accept',
        body: { platform: 'WEB', ...body },
      });
      return response.data;
    },
    onSuccess: (result, variables) => {
      initUserStore({
        auth: { id: result.user.userId, email: variables.maskedEmail },
        user: {
          userId: result.user.userId,
          publicId: result.user.publicId,
          username: result.user.username,
          status: result.user.status,
          verificationLevel: result.user.verificationLevel,
          createdAt: result.user.memberSince,
        },
        staff: null,
        tokens: toAccess(result),
      });
    },
  });
}
