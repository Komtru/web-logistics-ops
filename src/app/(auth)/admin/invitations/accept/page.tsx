import type { Metadata } from 'next';
import { Suspense } from 'react';

import { InvitationAcceptForm } from '@/app/(auth)/admin/invitations/accept/InvitationAcceptForm';
import { Spinner } from '@/components/general/spinner';

export const metadata: Metadata = {
  title: 'Accept invitation',
};

/**
 * Where the emailed invitation link lands:
 * `{OAUTH_REDIRECT_BASE_URL}/admin/invitations/accept?token=<token>` — this
 * route's URL is not a UI convention, it is what
 * `backend-apis`'s `staffInvitation.service.ts` (`buildAcceptUrl`) literally
 * builds and emails out. Unauthenticated by construction: sits in the
 * `(auth)` layout group, and `middleware.ts`'s matcher does not cover
 * `/admin/*`, so nothing here requires a session.
 *
 * Suspense boundary: `InvitationAcceptForm` reads `useSearchParams` for `token`.
 */
export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-40 items-center justify-center">
          <Spinner label="Loading your invitation" />
        </div>
      }
    >
      <InvitationAcceptForm />
    </Suspense>
  );
}
