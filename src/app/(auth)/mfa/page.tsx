import type { Metadata } from 'next';
import { Suspense } from 'react';

import { EnrolTotpForm } from '@/app/(auth)/mfa/EnrolTotpForm';
import { Spinner } from '@/components/general/spinner';

export const metadata: Metadata = {
  title: 'Set up two-factor',
};

/**
 * Sits in the `(auth)` group even though the operator already holds a session:
 * this is the last step of signing in, and the console shell would frame it as
 * if they were already through.
 *
 * Suspense boundary: `EnrolTotpForm` reads `useSearchParams` to carry
 * `redirect_uri` through to the far side of enrolment.
 */
export default function EnrolMfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center">
          <Spinner label="Loading setup" />
        </div>
      }
    >
      <EnrolTotpForm />
    </Suspense>
  );
}
