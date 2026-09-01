import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyForm } from '@/app/(auth)/verify/VerifyForm';
import { Spinner } from '@/components/general/spinner';

export const metadata: Metadata = {
  title: 'Confirm sign-in',
};

/** Step 2 of sign-in. Reached from `/` with `?email=` (and any `redirect_uri`). */
export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-40 items-center justify-center">
          <Spinner label="Loading confirmation" />
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
