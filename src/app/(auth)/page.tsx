import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/app/(auth)/LoginForm';
import { Spinner } from '@/components/general/spinner';

export const metadata: Metadata = {
  title: 'Sign in',
};

/**
 * The app's index is the login screen — an operator arriving at `/` is either
 * signing in or being bounced onward to `redirect_uri` by `LoginForm`.
 *
 * Suspense boundary: `LoginForm` reads `useSearchParams`, which opts the route
 * into client rendering without one.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-40 items-center justify-center">
          <Spinner label="Loading sign-in" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
