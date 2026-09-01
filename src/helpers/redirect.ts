/** Where an operator lands when no `redirect_uri` was supplied. */
export const DEFAULT_LANDING = '/dashboard';

/** Query key carrying the post-login destination. */
export const REDIRECT_PARAM = 'redirect_uri';

/**
 * Narrows a caller-supplied `redirect_uri` to a same-origin path.
 *
 * Anything else falls back to the default landing page, so a crafted link can't
 * bounce an operator (and the session they just created) to another origin.
 * Rejected: absolute URLs, protocol-relative `//host`, and the `/\host` form
 * some browsers still normalise to protocol-relative.
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_LANDING;

  const path = value.trim();

  if (!path.startsWith('/')) return DEFAULT_LANDING;
  if (path.startsWith('//') || path.startsWith('/\\')) return DEFAULT_LANDING;

  return path;
}
