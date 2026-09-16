'use client';

import { ErrorMessage, Field, Form, Formik } from 'formik';
import { ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import * as Yup from 'yup';

import { FloatingLabelInput } from '@/components/forms/floating-label-input';
import { Button } from '@/components/ui/button';
import { REDIRECT_PARAM, safeRedirectPath } from '@/helpers/redirect';
import { useCustomToast } from '@/hooks/useCustomToast';
import { useLogisticsLogin } from '@/services/auth.services';
import { isAuthenticated, useAuthStore } from '@/store/auth.store';

/** `POST auth/logistics/login`'s specific 403 — see M2 spec §2. */
const NO_LOGISTICS_ACCESS = 'NO_LOGISTICS_ACCESS';

const schema = Yup.object({
  identifier: Yup.string().trim().required('Email or phone is required.'),
  password: Yup.string().required('Password is required.'),
});

/**
 * Logistics portal sign-in: identifier (email or phone) + password against
 * `POST auth/logistics/login`.
 *
 * Single step, unlike this console's Staff OTP flow elsewhere in the app —
 * that flow (`useRequestOtp`/`useVerifyOtp`/`useVerifyMfa`, the `/verify`
 * screen) is untouched and simply isn't used here. This screen also doubles
 * as the invitation-acceptance screen for an INVITED logistics POC: there is
 * no separate accept step or token, a first successful login here is what
 * activates their company membership server-side.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useCustomToast();
  const logisticsLogin = useLogisticsLogin();

  const redirectTo = safeRedirectPath(searchParams.get(REDIRECT_PARAM));
  const hydrated = useAuthStore((state) => state.hydrated);

  /**
   * Why the operator is looking at this screen, when something ejected them here.
   *
   * - `session_expired` — `services/base.ts` after a 401 it could not refresh.
   * - `account_inactive` — `useSessionSync` after a Staff account check came
   *   back ineligible. Left as-is here for parity with the Staff screen's
   *   copy; `DashboardShell` only runs that check for a Staff session, so a
   *   Logistics session won't produce this reason in practice today.
   */
  const reason = searchParams.get('reason');
  const ejected = reason === 'session_expired';
  const inactive = reason === 'account_inactive';

  // A live session has no business on the login screen. Gated on hydrated
  // because the token lives in localStorage and is absent during SSR.
  useEffect(() => {
    if (hydrated && isAuthenticated()) router.replace(redirectTo);
  }, [hydrated, redirectTo, router]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="font-display text-base font-semibold">Sign in</h2>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          Sign in with your Komtru email or phone and password.
        </p>
      </div>

      {ejected ? (
        <p
          className="border-border bg-secondary/60 text-muted-foreground rounded-lg border p-3 text-[11.5px] leading-relaxed"
          role="status"
        >
          Your session ended and you were signed out. Sign in again to pick up where you left off.
        </p>
      ) : null}

      {inactive ? (
        <p
          className="border-komtru-risk/30 bg-komtru-risk-soft dark:bg-komtru-risk/10 rounded-lg border p-3 text-[11.5px] leading-relaxed"
          role="alert"
        >
          This account can no longer access the console and has been signed out. Contact an
          administrator to have it reinstated.
        </p>
      ) : null}

      <Formik
        initialValues={{ identifier: '', password: '' }}
        validationSchema={schema}
        onSubmit={({ identifier, password }) => {
          const normalized = identifier.trim();

          logisticsLogin.mutate(
            { identifier: normalized, password },
            {
              onSuccess: () => {
                router.replace(redirectTo);
              },
              onError: (error) => {
                const isNoAccess = error.errorCode === NO_LOGISTICS_ACCESS;

                showToast({
                  title: isNoAccess
                    ? "This account can't access the logistics portal"
                    : "Couldn't sign in",
                  description: isNoAccess
                    ? "This account isn't attached to a logistics company."
                    : error.message,
                  type: 'error',
                });
              },
            },
          );
        }}
      >
        {({ errors, touched, isValid, dirty }) => (
          <Form className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Field
                as={FloatingLabelInput}
                name="identifier"
                type="text"
                label="Email or phone"
                autoComplete="username"
                autoFocus
                required
                invalid={Boolean(touched.identifier && errors.identifier)}
              />
              <ErrorMessage
                name="identifier"
                render={(message) => (
                  <p className="text-komtru-risk text-[11.5px]" role="alert">
                    {message}
                  </p>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Field
                as={FloatingLabelInput}
                name="password"
                type="password"
                label="Password"
                autoComplete="current-password"
                required
                invalid={Boolean(touched.password && errors.password)}
              />
              <ErrorMessage
                name="password"
                render={(message) => (
                  <p className="text-komtru-risk text-[11.5px]" role="alert">
                    {message}
                  </p>
                )}
              />
            </div>

            <Button
              type="submit"
              size="xl"
              fullWidth
              disabled={logisticsLogin.isPending || !(dirty && isValid)}
            >
              {logisticsLogin.isPending ? 'Signing in…' : 'Sign in'}
              {logisticsLogin.isPending ? null : <ArrowRight aria-hidden />}
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  );
}
