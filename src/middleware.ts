import { NextResponse } from 'next/server';

/**
 * Deliberately a pass-through.
 *
 * Session tokens live in `localStorage` (see `store/auth.store.ts`), which the
 * edge runtime cannot read — so any check here would be theatre. Once tokens
 * are also written to cookies, this is where the real guard goes.
 */
export function middleware() {
  return NextResponse.next();
}

/**
 * Every route inside the `(dashboard)` group. They are listed one by one
 * because the group's URLs are top-level — there is no shared `/dashboard`
 * prefix to match on — so a new module needs an entry here as well as a page.
 */
export const config = {
  matcher: ['/auth/:path*', '/dashboard/:path*', '/settings/:path*'],
};
