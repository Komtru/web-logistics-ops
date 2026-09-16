'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '@/components/general/spinner';
import { AppSidebar } from '@/components/general/dashboard/Sidebar';
import { Topbar } from '@/components/general/dashboard/Topbar';
import { RealtimeProviders } from '@/components/realtime/realtime-providers';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { REDIRECT_PARAM } from '@/helpers/redirect';
import { useSessionSync } from '@/hooks/useSessionSync';
import { isAuthenticated, useAuthStore } from '@/store/auth.store';

/**
 * Client half of the dashboard layout: sidebar + topbar chrome and the animated
 * content surface. Module pages render into the rounded card.
 *
 * The session gate is client-side by necessity: tokens live in `localStorage`
 * (see `store/auth.store.ts`), which the edge runtime can't read, so
 * `middleware.ts` stays a pass-through. What it checks is only that a session
 * *exists* — whether that session is still any good is `useSessionSync`'s job,
 * and it answers a request later.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const hydrated = useAuthStore((state) => state.hydrated);
  const signedIn = hydrated && isAuthenticated();

  /**
   * `useSessionSync` re-reads `GET admin/me` — a Staff-only endpoint
   * (`useOperatorAccount`). A Logistics session has no operator account to
   * re-read there and no business calling it, so it's gated off for one.
   */
  const isLogisticsSession = useAuthStore((state) => Boolean(state.logistics));

  /**
   * The whole-console session refresh, mounted here because this is the one
   * component every module page renders inside — so "on page load" means one
   * read, not one per screen. TanStack Query dedupes it across remounts.
   *
   * Called unconditionally (hooks must be), gated by `enabled`: there is
   * nothing to re-read before the store has rehydrated, a signed-out
   * visitor must not fire an authenticated request at all, and a Logistics
   * session has no `admin/me` to read in the first place.
   */
  useSessionSync({ enabled: signedIn && !isLogisticsSession });

  // Bounce to sign-in carrying where the operator was headed, so verifying the
  // code lands them here rather than on the default page.
  useEffect(() => {
    if (hydrated && !isAuthenticated()) {
      const query = searchParams.toString();
      const target = query ? `${pathname}?${query}` : pathname;

      router.replace(`/?${REDIRECT_PARAM}=${encodeURIComponent(target)}`);
    }
  }, [hydrated, pathname, searchParams, router]);

  // Nothing of the console renders until the session is known: a flash of the
  // shell would leak module chrome to a signed-out visitor.
  if (!signedIn) {
    return (
      <div className="shell-blend flex min-h-svh items-center justify-center">
        <Spinner label={hydrated ? 'Redirecting to sign-in' : 'Restoring session'} showLabel />
      </div>
    );
  }

  return (
    // Below the session gate on purpose: this is what makes "no socket for a
    // signed-out visitor" structural. The provider is never rendered for one,
    // so there is no connection to stand down — and it unmounts, closing the
    // socket, the moment the session goes away.
    <RealtimeProviders>
      <TooltipProvider delayDuration={200}>
        {/* The wash lives on the provider's wrapper — the one element that spans
          both the sidebar and the content — so the panes never meet at a seam.
          Everything inside stays transparent to let it through. */}
        <SidebarProvider className="shell-blend">
          <AppSidebar />
          <SidebarInset className="bg-transparent">
            <Topbar />
            <main className="flex-1 p-4 md:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="min-h-[calc(100vh-7rem)]"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </RealtimeProviders>
  );
}
