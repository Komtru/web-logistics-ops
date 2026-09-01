'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { errorMessageOf } from '@/components/general/query-state';
import { Spinner } from '@/components/general/spinner';
import { OtpInput } from '@/components/forms/otp-input';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/helpers/format';
import { useCustomToast } from '@/hooks/useCustomToast';
import { OTP_CODE_LENGTH, OTP_LIFETIME_MINUTES } from '@/interfaces/auth';
import { useAdminMe } from '@/services/auth.services';
import { useAcceptInvitation, useInvitationPreview, useRequestInvitationOtp } from '@/services/invitations.services';
import { useAuthStore } from '@/store/auth.store';

/** Seconds before another code can be requested — mirrors `VerifyForm`'s cooldown. */
const RESEND_COOLDOWN = 30;

/**
 * The page an invited staff member lands on from the emailed link:
 * `{OAUTH_REDIRECT_BASE_URL}/admin/invitations/accept?token=<token>` — a URL
 * this app's own route matches exactly (`app/(auth)/admin/invitations/accept`),
 * not one this app invented.
 *
 * Three steps, matching identity's real endpoints one for one:
 * 1. **Peek** (`useInvitationPreview`) — who invited them, to what role. Reading
 *    changes nothing.
 * 2. **Request a code** (`useRequestInvitationOtp`) — mailed to the address
 *    the invitation names; this page can never supply one.
 * 3. **Accept** (`useAcceptInvitation`) — redeems the code, creates or
 *    promotes the account, grants the role, and issues a session. `nextStep`
 *    is always `ENROL_MFA`, so success always routes to `/mfa`.
 */
export function InvitationAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useCustomToast();

  const token = searchParams.get('token') ?? undefined;

  const preview = useInvitationPreview(token);
  const requestOtp = useRequestInvitationOtp();
  const accept = useAcceptInvitation();
  const adminMe = useAdminMe();

  const [codeRequested, setCodeRequested] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!token) {
    return (
      <div className="space-y-1.5">
        <h2 className="font-display text-base font-semibold">This link is incomplete</h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          The invitation link is missing its token. Ask whoever invited you to send it again.
        </p>
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner label="Loading your invitation" showLabel />
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    // The API distinguishes invalid / already-claimed-or-cancelled / expired —
    // each is a stable, final answer, not something a retry fixes.
    return (
      <div className="space-y-1.5">
        <h2 className="font-display text-base font-semibold">Can&apos;t accept this invitation</h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          {errorMessageOf(preview.error, 'That invitation link is not valid.')}
        </p>
      </div>
    );
  }

  const invitation = preview.data;
  const maskedEmail = requestOtp.data?.maskedEmail ?? invitation.email;
  const expiryMinutes = requestOtp.data
    ? Math.max(1, Math.round(requestOtp.data.expiresInSeconds / 60))
    : OTP_LIFETIME_MINUTES;

  const sendCode = () => {
    requestOtp.mutate(
      { token },
      {
        onSuccess: () => {
          setCodeRequested(true);
          setCooldown(RESEND_COOLDOWN);
          setCode('');
        },
        onError: (error) => {
          showToast({
            title: "Couldn't send the code",
            description: errorMessageOf(error),
            type: 'error',
          });
        },
      },
    );
  };

  const submitCode = (value: string) => {
    if (value.length !== OTP_CODE_LENGTH || accept.isPending) return;

    accept.mutate(
      { token, code: value, maskedEmail },
      {
        onSuccess: () => {
          // Backfill the roles/permissions block the accept response doesn't
          // carry (see `useAdminMe`'s doc comment) — best-effort, and the
          // operator proceeds to MFA enrolment either way, because the
          // session tokens are already valid regardless of whether this
          // follow-up call succeeds.
          adminMe.mutate(undefined, {
            onSuccess: (me) => {
              const state = useAuthStore.getState();
              if (state.auth && state.user && state.access && state.refresh) {
                state.initUserStore({
                  auth: state.auth,
                  user: state.user,
                  staff: me.staff,
                  tokens: { access: state.access, refresh: state.refresh },
                });
              }
            },
            onSettled: () => {
              router.replace('/mfa');
            },
          });
        },
        onError: (error) => {
          setCode('');
          showToast({
            title: "That code didn't work",
            description: errorMessageOf(error),
            type: 'error',
          });
        },
      },
    );
  };

  if (!codeRequested) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold">You&apos;re invited</h2>
          <p className="text-muted-foreground text-[12.5px] leading-relaxed">
            <span className="text-foreground font-medium">{invitation.inviterDisplayName}</span>{' '}
            invited you to join Komtru Logistics Ops as{' '}
            <span className="text-foreground font-medium">{invitation.roleName}</span>.
          </p>
        </div>

        <p className="border-border bg-secondary/60 text-muted-foreground rounded-lg border p-3 text-[11.5px] leading-relaxed">
          We&apos;ll send a code to <span className="text-foreground font-medium">{invitation.email}</span> to
          confirm it&apos;s you. This invitation expires {formatDateTime(invitation.expiresAt)}.
        </p>

        <Button
          size="xl"
          fullWidth
          onClick={sendCode}
          disabled={requestOtp.isPending}
        >
          {requestOtp.isPending ? 'Sending code…' : 'Send code'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="font-display text-base font-semibold">Enter your code</h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          A {OTP_CODE_LENGTH}-digit code was sent to{' '}
          <span className="text-foreground font-medium">{maskedEmail}</span>. It expires in{' '}
          {expiryMinutes} minute{expiryMinutes === 1 ? '' : 's'}.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submitCode(code);
        }}
      >
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submitCode}
          length={OTP_CODE_LENGTH}
          disabled={accept.isPending}
          invalid={accept.isError}
        />

        <Button
          type="submit"
          size="xl"
          fullWidth
          disabled={accept.isPending || code.length !== OTP_CODE_LENGTH}
        >
          {accept.isPending ? 'Confirming…' : 'Accept invitation'}
        </Button>
      </form>

      <div className="flex items-center justify-end text-[11.5px]">
        <button
          type="button"
          onClick={sendCode}
          disabled={cooldown > 0 || requestOtp.isPending}
          className="text-komtru-blue dark:text-primary disabled:text-muted-foreground font-medium hover:underline disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
