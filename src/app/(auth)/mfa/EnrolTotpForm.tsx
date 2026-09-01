'use client';

import { Check, Copy, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { OtpInput } from '@/components/forms/otp-input';
import { Spinner } from '@/components/general/spinner';
import { Button } from '@/components/ui/button';
import { describeMfaGrace, MFA_GRACE_DAYS } from '@/helpers/mfa';
import { REDIRECT_PARAM, safeRedirectPath } from '@/helpers/redirect';
import { useCustomToast } from '@/hooks/useCustomToast';
import { OTP_CODE_LENGTH } from '@/interfaces/auth';
import { useActivateTotp, useEnrolTotp } from '@/services/auth.services';
import { isAuthenticated, useAuthStore } from '@/store/auth.store';

/**
 * TOTP enrolment, reached when sign-in answers `nextStep: 'ENROL_MFA'`.
 *
 * Authenticator app only. The API also enrols SMS and email factors, but staff
 * sign-in *is* an email OTP — a second email factor would re-use the channel
 * already proven rather than adding an independent one, so offering it would be
 * security theatre.
 *
 * The seed is fetched once, on mount, and held in component state: `enroll`
 * returns it a single time, so re-running it to recover from a mistyped code
 * would orphan the previous PENDING factor and change the QR under the operator
 * mid-scan.
 */
export function EnrolTotpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useCustomToast();

  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const enrol = useEnrolTotp();
  const activate = useActivateTotp();

  const redirectTo = safeRedirectPath(searchParams.get(REDIRECT_PARAM));
  const grace = describeMfaGrace(user?.createdAt);

  // Enrolment needs the very session sign-in just issued; without one there is
  // no account to attach a factor to.
  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.replace('/');
  }, [hydrated, router]);

  /**
   * Requested once per mount.
   *
   * A ref rather than the mutation's own `isPending`/`isSuccess`: Strict Mode
   * invokes effects twice back-to-back within one commit, before any re-render,
   * so those flags have not flipped yet on the second pass — and every call
   * mints a *separate* PENDING factor, orphaning the first.
   */
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    if (!hydrated || !isAuthenticated()) return;

    requestedRef.current = true;
    enrol.mutate();
  }, [hydrated, enrol]);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const enrolment = enrol.data;

  const copySecret = async () => {
    if (!enrolment) return;

    try {
      await navigator.clipboard.writeText(enrolment.secret);
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright (permission, or a non-secure
      // context). The secret is on screen either way, so say so rather than
      // leaving a button that silently does nothing.
      showToast({
        title: "Couldn't copy",
        description: 'Select the key and copy it manually.',
        type: 'warning',
      });
    }
  };

  const submit = (value: string) => {
    if (!enrolment || value.length !== OTP_CODE_LENGTH || activate.isPending) return;

    activate.mutate(
      { factorId: enrolment.factorId, code: value },
      {
        onSuccess: () => {
          showToast({
            title: 'Authenticator enrolled',
            description: 'You will be asked for a code the next time you sign in.',
            type: 'success',
          });
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

  if (enrol.isPending || (!enrol.isSuccess && !enrol.isError)) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Spinner label="Preparing your authenticator key" showLabel />
      </div>
    );
  }

  if (enrol.isError || !enrolment) {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold">Couldn&apos;t start enrolment</h2>
          <p className="text-muted-foreground text-[12.5px] leading-relaxed">
            {enrol.error?.message ?? 'The identity service did not return an authenticator key.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => enrol.mutate()} disabled={enrol.isPending}>
            Try again
          </Button>
          {/* Still offered on failure: the operator holds a valid session, and
              trapping them on a broken setup screen would be worse than letting
              them into the console while the window is open. */}
          {grace.canSkip ? (
            <Button variant="outline" size="sm" onClick={() => router.replace(redirectTo)}>
              Continue without it
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="font-display flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="text-komtru-cyan size-4 shrink-0" aria-hidden />
          Set up your authenticator
        </h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          Scan this with an authenticator app, then enter the {OTP_CODE_LENGTH}-digit code it shows
          to confirm.
        </p>
      </div>

      {/* White plate regardless of theme: QR contrast is a scanning
          requirement, and a dark-inverted code fails on many readers. */}
      <div className="flex justify-center">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <QRCodeSVG value={enrolment.otpauthUri} size={168} level="M" marginSize={0} />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-[11.5px]">Or enter this key by hand:</p>
        <div className="border-border/70 bg-muted/40 flex items-center gap-2 rounded-lg border p-2.5">
          <code className="trade-code min-w-0 flex-1 text-[12px] break-all">
            {enrolment.secret}
          </code>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copySecret}
            aria-label="Copy setup key"
            className="shrink-0"
          >
            {copied ? (
              <Check className="text-komtru-cyan size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          This key is shown once. It isn&apos;t stored anywhere you can read it back.
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
          disabled={activate.isPending}
          invalid={activate.isError}
        />

        <Button
          type="submit"
          size="xl"
          fullWidth
          disabled={activate.isPending || code.length !== OTP_CODE_LENGTH}
        >
          {activate.isPending ? 'Confirming…' : 'Confirm and continue'}
        </Button>
      </form>

      {grace.canSkip ? (
        <div className="space-y-1.5 text-center">
          <button
            type="button"
            onClick={() => router.replace(redirectTo)}
            className="text-muted-foreground hover:text-foreground text-[11.5px] font-medium transition-colors"
          >
            Skip for now
          </button>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            {grace.daysRemaining === null
              ? `New accounts can defer this for ${MFA_GRACE_DAYS} days.`
              : `You can defer this for ${grace.daysRemaining} more ${
                  grace.daysRemaining === 1 ? 'day' : 'days'
                }.`}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
          This account is past its {MFA_GRACE_DAYS}-day setup window, so enrolment can no longer be
          deferred.
        </p>
      )}
    </div>
  );
}
