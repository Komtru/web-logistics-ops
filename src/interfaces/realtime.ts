import type { ISODateString } from '@/interfaces/common';

/**
 * A push that arrived on this connection.
 *
 * `payload` is `unknown` on purpose: this layer is transport, and typing the
 * body would mean encoding the notification catalogue here rather than in the
 * module that renders it. Consumers narrow it themselves.
 */
export interface LiveNotification {
  /**
   * Client-side id, minted on arrival.
   *
   * Not the server's notification id — the payload is opaque here, so there is
   * nothing to read one out of. This exists to be a stable React key for the
   * session; anything that needs the durable id gets it from the payload.
   */
  id: string;
  /** When this tab received it, which is not necessarily when it was sent. */
  receivedAt: ISODateString;
  payload: unknown;
}
