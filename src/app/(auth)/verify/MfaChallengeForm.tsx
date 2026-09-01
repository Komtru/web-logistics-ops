'use client';

import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { OtpInput } from '@/components/forms/otp-input';
import { Button } from '@/components/ui/button';
import {
  describeNextStep,
  isSignInComplete,
  preferredFactor,
  usableLoginFactors,
} from '@/helpers/session';
import { useCustomToast } from '@/hooks/useCustomToast';
import { OTP_CODE_LENGTH, type MfaChallenge } from '@/interfaces/auth';
import { useVerifyMfa } from '@/services/auth.services';
import { cn } from '@/lib/utils';

interface MfaChallengeFormProps {
  /** Carried from step 1 — the session response omits it. */
  email: string;
  challenge: MfaChallenge;
  /** Where to land once the second factor clears. */
  redirectTo: string;
}

/**
 * Step 3 of sign-in: answer the second factor.
 *
 * Rendered in place by `VerifyForm` rather than on its own route, because the
 * `mfaToken` is a bearer credential. A route would have to carry it in the URL,
 * where it would land in browser history, the referrer header and any proxy log
 * — for a token that is, by itself, one factor away from a staff session.
 *
 * **One attempt, by construction.** The service consumes `mfaToken` with an
 * atomic GETDEL before it validates the code, so a wrong digit destroys the
 * challenge as surely as a right one spends it. There is no retry to offer, and
 * pretending otherwise would leave the operator typing into a token the server
 * has already forgotten — so a failure ends the attempt and sends them back to
 * request a fresh code.
 */
export function MfaChallengeForm({ email, challenge, redirectTo }: MfaChallengeFormProps) {
  const router = useRouter();
  const { showToast } = useCustomToast();

  const usable = usableLoginFactors(challenge.factors);

  const [factorId, setFactorId] = useState(() => preferredFactor(usable)?.id ?? '');
  const [code, setCode] = useState('');
  /** Set once the token has been spent, successfully or not. */
  const [spent, setSpent] = useState(false);

  const verifyMfa = useVerifyMfa();

  const submit = (value: string) => {
    if (!factorId || value.length !== OTP_CODE_LENGTH || verifyMfa.isPending || spent) return;

    verifyMfa.mutate(
      { email, mfaToken: challenge.mfaToken, factorId, code: value },
      {
        onSuccess: (result) => {
          // None of the steps reachable from here has a screen — enrolment can't
          // come back, since answering a factor proves one is active — so this
          // announces and continues rather than routing.
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
          setSpent(true);
          setCode('');
          showToast({
            title: 'That attempt was spent',
            description: error.message,
            type: 'error',
            duration: 8000,
          });
        },
      },
    );
  };

  // Every factor on the account is one the console can't answer. Say which, and
  // why, rather than rendering an input that cannot succeed.
  if (!usable.length) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold">Second factor required</h2>
          <p className="text-muted-foreground text-[12.5px] leading-relaxed">
            Your code was accepted, but this account&apos;s only factors are ones the console
            can&apos;t verify.
          </p>
        </div>

        <div className="border-komtru-warning/40 bg-komtru-gold-soft dark:bg-komtru-warning/10 space-y-2 rounded-lg border p-3.5">
          <p className="text-komtru-warning-on-soft dark:text-komtru-gold-soft flex items-center gap-2 text-[12.5px] font-semibold">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            Enrolled factors
          </p>
          <ul className="space-y-1">
            {challenge.factors.map((factor) => (
              <li key={factor.id} className="text-muted-foreground text-[11.5px] leading-relaxed">
                <span className="text-foreground font-medium">{factor.hint}</span>
                {factor.type === 'PASSKEY'
                  ? ' — passkeys need a browser security-key prompt the console has not built.'
                  : ' — one-time codes to a phone or mailbox cannot be requested; the API has no route to send them.'}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground text-[11.5px] leading-relaxed">
          Ask an administrator to reset MFA on this account, then enrol an authenticator app.
        </p>

        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[11.5px] transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to sign-in
        </Link>
      </div>
    );
  }

  if (spent) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold">Start sign-in again</h2>
          <p className="text-muted-foreground text-[12.5px] leading-relaxed">
            That challenge can only be answered once, so it&apos;s now used up — whether the code
            was wrong or simply late. Request a new sign-in code and try again.
          </p>
        </div>

        <Button size="xl" fullWidth onClick={() => router.replace('/')}>
          Back to sign-in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="font-display flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="text-komtru-cyan size-4 shrink-0" aria-hidden />
          Enter your authenticator code
        </h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          Your email code was accepted. Open your authenticator app and enter the {OTP_CODE_LENGTH}
          -digit code it shows for Komtru.
        </p>
      </div>

      {/* Only rendered when there is a real choice to make. With one factor the
          picker would be a single button that changes nothing. */}
      {usable.length > 1 ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-[11.5px]">Which authenticator?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Authenticator">
            {usable.map((factor) => (
              <button
                key={factor.id}
                type="button"
                role="radio"
                aria-checked={factorId === factor.id}
                onClick={() => setFactorId(factor.id)}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
                  factorId === factor.id
                    ? 'border-komtru-cyan bg-komtru-cyan/10 text-foreground'
                    : 'border-border/70 text-muted-foreground hover:text-foreground',
                )}
              >
                {factor.hint}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
          disabled={verifyMfa.isPending}
          label="Authenticator code"
        />

        <Button
          type="submit"
          size="xl"
          fullWidth
          disabled={verifyMfa.isPending || code.length !== OTP_CODE_LENGTH}
        >
          {verifyMfa.isPending ? 'Verifying…' : 'Verify and continue'}
        </Button>
      </form>

      <div className="border-border/70 bg-muted/30 flex items-start gap-2 rounded-lg border p-3">
        <KeyRound className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          You get one attempt — the challenge is single-use and expires five minutes after your
          email code was accepted. A wrong code means starting sign-in over, not a lockout.
        </p>
      </div>
    </div>
  );
}
