/**
 * Where the realtime gateway lives, and the one event name this layer knows.
 *
 * Kept out of the provider so the connection code has no literals in it and a
 * deployment change is a config change.
 */

/**
 * Origin of the Socket.IO server.
 *
 * Deliberately *not* routed through the `/api` rewrite the rest of the app uses
 * (`next.config.ts`). That rewrite exists so browser traffic is same-origin and
 * CORS-free, but it proxies HTTP requests — a WebSocket upgrade through it is
 * not something Next guarantees, and the gateway needs a persistent process
 * rather than the serverless function a Next route would be. So the socket
 * talks to the backend origin directly, and the backend's `SOCKET_CORS_ORIGINS`
 * has to name this app's origin.
 *
 * Blank disables realtime entirely — see `isRealtimeConfigured`. Local work on
 * modules that don't need pushes shouldn't have to run the gateway.
 */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? '';

/**
 * HTTP path the handshake is served on. Mirrors the backend's `SOCKET_PATH`,
 * which defaults to the same value; both sides have to agree or the handshake
 * 404s before authentication is ever attempted.
 */
export const SOCKET_PATH = '/socket';

/**
 * The event the backend pushes to a principal's personal room.
 *
 * One name for everything addressed at the signed-in operator; what a given
 * notification *means* is carried in its payload and interpreted by the
 * Notifications module, not here.
 */
export const NOTIFICATION_EVENT = 'notification';

/**
 * How many live notifications are kept in memory.
 *
 * Bounded because a console tab stays open for a shift and this buffer is a
 * convenience, not storage — the authoritative history is behind the API, which
 * is also what a reconnect re-reads (see `useSocketReconnect`).
 */
export const MAX_LIVE_NOTIFICATIONS = 50;

/** Whether a gateway origin was configured at build time. */
export const isRealtimeConfigured = Boolean(SOCKET_URL);
