import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LogoutView } from '@/app/(auth)/logout/LogoutView';
import { Spinner } from '@/components/general/spinner';

export const metadata: Metadata = {
  title: 'Signing out',
};

/**
 * Sits in the `(auth)` group, not `(dashboard)`: the console's shell gates on a
 * live session, and this page's whole job is to destroy one.
 *
 * Suspense boundary: `LogoutView` reads `useSearchParams` for `?scope=all`.
 */
export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-40 items-center justify-center">
          <Spinner label="Signing out" />
        </div>
      }
    >
      <LogoutView />
    </Suspense>
  );
}
