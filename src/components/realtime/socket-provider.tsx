'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import { isRealtimeConfigured, SOCKET_PATH, SOCKET_URL } from '@/config/realtime';
import { useAuthStore } from '@/store/auth.store';

/**
 * One connection per session, owned here and nowhere else.
 *
 * ## Why this isn't the shape the setup document describes
 *
 * The document assumes a server-side session (an httpOnly cookie a Server
 * Component can read) and therefore a Server Component layout that verifies it
 * and mints a short-lived, socket-scoped JWT to hand down as a prop.
 *
 * Neither half of that exists in this console, and both differences are
 * deliberate rather than pending:
 *
 * - **No server session.** Tokens live in `localStorage` via Zustand
 *   (`store/auth.store.ts`), which is why `middleware.ts` is a pass-through and
 *   why the session gate is `DashboardShell`, a Client Component. There is no
 *   `getServerSession` to call, so §5's Server Component layout has nothing to
 *   verify. The equivalent guarantee is structural all the same: this provider
 *   is mounted *inside* `DashboardShell`'s signed-in branch, so a signed-out
 *   visitor unmounts it before it can ever open a socket.
 *
 * - **No minted socket token.** The backend explicitly rejects a second signing
 *   secret — `SOCKET_AUTH_TOKEN_SECRET` does not exist there, and the handshake
 *   is verified with the same Ed25519 key and the same epoch/session checks as
 *   an HTTP request. So the credential is simply the access token the axios
 *   layer already sends as a `Bearer`, read from the store. Minting a parallel
 *   token would be the second identity system that arrangement is designed to
 *   avoid.
 *
 * The consequence is a better story than §10's caveat, not a worse one: because
 * the client holds its own credential, `auth` below is a *callback* rather than
 * a captured value, so every connection attempt — including automatic
 * reconnects hours later — picks up whatever token is current at that instant.
 * Nothing goes stale, and no page navigation is needed to refresh it.
 */

interface SocketContextValue {
  /** `null` until the connection is created, and while realtime is disabled. */
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

/**
 * Backoff for handshakes the *server rejected*, which socket.io does not retry
 * on its own.
 *
 * A rejected handshake means the token was expired or the session is gone.
 * Neither is necessarily permanent — the axios layer refreshes the access token
 * on the next 401 and writes it back to the store — so giving up entirely would
 * leave a tab silently push-less for the rest of a shift. Retrying forever at
 * the 30s ceiling is negligible traffic, and the alternative failure mode (a
 * genuinely dead session) is already handled elsewhere: the same 401 that
 * cannot be refreshed hard-redirects to sign-in, which unmounts this provider.
 */
const REJECTED_RETRY_MS = [2_000, 5_000, 15_000, 30_000];

export function SocketProvider({ children }: { children: ReactNode }) {
  /**
   * Keyed on the operator, not on the token.
   *
   * Depending on the token would tear down and rebuild the connection every ten
   * minutes when it rotates, which is exactly what the `auth` callback exists to
   * avoid. Keying on `userId` still rebuilds if a different operator signs in
   * without a full reload, which is the one case that genuinely needs a new
   * handshake.
   */
  const userId = useAuthStore((state) => state.user?.userId);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isRealtimeConfigured || !userId) return;

    let rejections = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const instance = io(SOCKET_URL, {
      path: SOCKET_PATH,
      // Read fresh on every connection attempt rather than captured once —
      // see the note above on token rotation. Read imperatively from the store
      // for the same reason: subscribing would put it in this effect's deps.
      auth: (send) => send({ token: useAuthStore.getState().access?.token }),
      // socket.io-client already reconnects with backoff for transport-level
      // failures; only server-side rejections need handling below.
    });

    const onConnect = () => {
      rejections = 0;
      setConnected(true);
    };

    const onDisconnect = () => setConnected(false);

    const onConnectError = () => {
      setConnected(false);

      // `active` false means the server refused the handshake, so socket.io has
      // stopped and will not come back without being told to.
      if (instance.active) return;

      const delay = REJECTED_RETRY_MS[Math.min(rejections, REJECTED_RETRY_MS.length - 1)]!;
      rejections += 1;
      retryTimer = setTimeout(() => instance.connect(), delay);
    };

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    instance.on('connect_error', onConnectError);

    setSocket(instance);

    return () => {
      clearTimeout(retryTimer);
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
      instance.off('connect_error', onConnectError);
      instance.disconnect();

      setSocket(null);
      setConnected(false);
    };
  }, [userId]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/**
 * Subscribe to a socket event for as long as the calling component is mounted.
 *
 * The handler is held in a ref, so an inline arrow function — the normal way to
 * call this — doesn't resubscribe on every render while still seeing current
 * props and state.
 */
export function useSocketEvent<T = unknown>(
  eventName: string,
  handler: (payload: T) => void,
): void {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;

    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }, [socket, eventName]);
}

/**
 * Run something after the connection comes *back*, never on the first connect.
 *
 * A live event is "something changed, go check" — it is never the only copy of
 * the truth. While a socket is down, pushes are simply missed, so anything
 * driven by them has to re-read the API on reconnect rather than assume the gap
 * was empty. This is the seam that re-read hangs off: a query invalidation, a
 * refetch, whatever the owning module already uses.
 *
 * Detected from the `connected` transition rather than socket.io's own
 * `reconnect` event, because that event doesn't cover the rejected-handshake
 * retry above — and from a consumer's point of view both are the same gap.
 */
export function useSocketReconnect(handler: () => void): void {
  const { connected } = useSocket();
  const handlerRef = useRef(handler);
  const hasConnected = useRef(false);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!connected) return;

    // First connect since this component mounted: whatever it renders was
    // fetched normally a moment ago, so there is nothing to catch up on.
    if (hasConnected.current) handlerRef.current();
    hasConnected.current = true;
  }, [connected]);
}
