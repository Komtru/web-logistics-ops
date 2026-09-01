'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MfaChallengeForm } from '@/app/(auth)/verify/MfaChallengeForm';
import { OtpInput } from '@/components/forms/otp-input';
import { Button } from '@/components/ui/button';
import {
  describeNextStep,
  isMfaChallenge,
  isSignInComplete,
  requiresMfaEnrolment,
} from '@/helpers/session';
import { REDIRECT_PARAM, safeRedirectPath } from '@/helpers/redirect';
import { useCustomToast } from '@/hooks/useCustomToast';
import { OTP_CODE_LENGTH, OTP_LIFETIME_MINUTES, type MfaChallenge } from '@/interfaces/auth';
import { useRequestOtp, useVerifyOtp } from '@/services/auth.services';

/**
 * Seconds before another code can be requested. The API allows 5/min per
 * address, so this sits comfortably inside the limit — and a throttled request
 * looks identical to a delivered one, which would be invisible to the operator.
 */
const RESEND_COOLDOWN = 30;

/**
 * Step 2 of sign-in: exchange the mailed code for a session.
 *
 * Three outcomes, all a 200:
 * - **a session** — `useVerifyOtp` has already committed it to the store, so
 *   this only navigates. `replace`, not `push`, so Back can't return a
 *   signed-in operator to a spent code.
 * - **a session plus `ENROL_MFA`** — routed to `/mfa`, which can act on it.
 * - **a challenge** — the account has an active factor, so `MfaChallengeForm`
 *   takes over in place.
 */
export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useCustomToast();

  const email = searchParams.get('email');
  const redirectTo = safeRedirectPath(searchParams.get(REDIRECT_PARAM));

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  /**
   * Held when the API answers step 2 with a challenge instead of a session.
   *
   * Kept in state rather than pushed to a route: `mfaToken` is a bearer
   * credential, and a URL would spill it into history, referrers and proxy logs.
   */
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);

  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();

  // Landing here without an email means the link was hand-made or step 1 was
  // skipped; there's nothing to verify against, so start over.
  useEffect(() => {
    if (!email) router.replace('/');
  }, [email, router]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!email) return null;

  const submit = (value: string) => {
    if (value.length !== OTP_CODE_LENGTH || verifyOtp.isPending) return;

    verifyOtp.mutate(
      { email, code: value },
      {
        onSuccess: (result) => {
          // Hand the challenge to step 3, which replaces this form.
          if (isMfaChallenge(result)) {
            setChallenge(result);
            setCode('');
            return;
          }

          // Enrolment has a screen, so send them to it rather than announcing
          // the obligation and dropping them in the console. `redirect_uri`
          // rides along so finishing setup — or skipping it while the grace
          // window is open — still lands where they were headed.
          if (requiresMfaEnrolment(result.nextStep)) {
            const query = new URLSearchParams();
            if (redirectTo) query.set(REDIRECT_PARAM, redirectTo);

            router.replace(`/mfa?${query.toString()}`);
            return;
          }

          // The session is live either way; a remaining `nextStep` is
          // outstanding setup, not a failed sign-in, and none of the others has
          // a screen — so say so on the way through rather than blocking the
          // operator out of the console.
          if (!isSignInComplete(result.nextStep)) {
            showToast({
              title: 'Signed in — one thing left',
              description: describeNextStep(result.nextStep!),
              type: 'warning',
              duration: 8000,
            });
          }

          router.replace(redirectTo);
        },
        onError: (error) => {
          setCode('');
          showToast({
            title: "That code didn't work",
            description: error.message,
            type: 'error',
          });
        },
      },
    );
  };

  const resend = () => {
    requestOtp.mutate(
      { email },
      {
        // Worded as "if the address can sign in" on purpose: a 202 here means
        // the request was accepted, never that an email went out.
        // Deliberately does not clear `challenge`. The resend button is only
        // reachable before one arrives, but a request already in flight can
        // still land after — and a new email code does not invalidate an
        // `mfaToken` already issued, so discarding it here would throw away a
        // live challenge and force a full restart.
        onSuccess: () => {
          setCode('');
          setCooldown(RESEND_COOLDOWN);
          showToast({
            title: 'Code requested',
            description: `If ${email} can sign in, a new code is on its way.`,
            type: 'success',
          });
        },
        onError: (error) => {
          showToast({
            title: "Couldn't resend the code",
            description: error.message,
            type: 'error',
          });
        },
      },
    );
  };

  // The email code is spent and a second factor is outstanding: replace this
  // form rather than stacking the two, so there is only ever one code input on
  // screen and no question which one a code belongs in.
  if (challenge) {
    return <MfaChallengeForm email={email} challenge={challenge} redirectTo={redirectTo} />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="font-display text-base font-semibold">Enter your code</h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          If <span className="text-foreground font-medium">{email}</span> can sign in, a{' '}
          {OTP_CODE_LENGTH}-digit code is on its way. It expires in {OTP_LIFETIME_MINUTES} minutes.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit(code);
        }}
      >
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          length={OTP_CODE_LENGTH}
          disabled={verifyOtp.isPending}
          invalid={verifyOtp.isError}
        />

        <Button
          type="submit"
          size="xl"
          fullWidth
          disabled={verifyOtp.isPending || code.length !== OTP_CODE_LENGTH}
        >
          {verifyOtp.isPending ? 'Verifying…' : 'Verify and continue'}
        </Button>
      </form>

      <div className="flex items-center justify-between text-[11.5px]">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Use a different email
        </Link>

        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || requestOtp.isPending}
          className="text-komtru-blue dark:text-primary disabled:text-muted-foreground font-medium hover:underline disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
