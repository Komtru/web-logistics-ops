'use client';

import type { ReactNode } from 'react';

import { NotificationProvider } from '@/components/realtime/notification-provider';
import { SocketProvider } from '@/components/realtime/socket-provider';

/**
 * The single mount point for realtime, so callers wire up one component rather
 * than remembering the nesting order.
 *
 * Mounted inside `DashboardShell`'s signed-in branch — not in the root layout —
 * so the sign-in, MFA and logout screens never open a connection at all. That
 * is by construction: the provider isn't rendered for them, rather than being
 * rendered and told to stand down.
 */
export function RealtimeProviders({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </SocketProvider>
  );
}
