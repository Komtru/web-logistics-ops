import type { Metadata } from 'next';
import { Suspense } from 'react';

import { fonts } from '@/app/fonts';
import { Spinner } from '@/components/general/spinner';
import { DashboardShell } from '@/app/(dashboard)/DashboardShell';

export const metadata: Metadata = {
  title: 'Control room',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={fonts.body.className}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Spinner label="Loading control room" showLabel />
          </div>
        }
      >
        <DashboardShell>{children}</DashboardShell>
      </Suspense>
    </div>
  );
}
