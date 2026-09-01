'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';

import { useSocketEvent } from '@/components/realtime/socket-provider';
import { MAX_LIVE_NOTIFICATIONS, NOTIFICATION_EVENT } from '@/config/realtime';
import type { LiveNotification } from '@/interfaces/realtime';

/**
 * Everything the backend pushes to the operator's personal room, collected in
 * one place so no feature has to wire up "the user gets notified" itself.
 *
 * Transport only. What a notification means, how it reads and where it links
 * are the Notifications module's concern — this holds opaque payloads and a
 * count, and deliberately renders nothing.
 */

interface NotificationContextValue {
  /** Newest first. Capped at `MAX_LIVE_NOTIFICATIONS`. */
  notifications: LiveNotification[];
  /** Arrivals since the last `markAllRead`, not a server-side unread count. */
  unreadCount: number;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useSocketEvent(NOTIFICATION_EVENT, (payload: unknown) => {
    setNotifications((previous) =>
      [{ id: uuid(), receivedAt: new Date().toISOString(), payload }, ...previous].slice(
        0,
        MAX_LIVE_NOTIFICATIONS,
      ),
    );

    setUnreadCount((count) => count + 1);
  });

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAllRead }),
    [notifications, unreadCount, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
