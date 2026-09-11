import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { IAuthStore } from '@/interfaces/auth';

/**
 * `localStorage` key the session persists under.
 *
 * Exported because signing out has to delete the record outright, not just null
 * its fields — see `clearClientSession` in `helpers/session.ts`.
 */
export const AUTH_STORAGE_KEY = 'komtru-logistics-auth-store';

/**
 * The only place server data is mirrored into client state: the session.
 * Everything else lives in TanStack Query.
 */
export const useAuthStore = create<IAuthStore>()(
  persist(
    (set) => ({
      access: undefined,
      refresh: undefined,
      auth: null,
      user: null,
      organization: null,
      staff: null,
      logistics: null,
      profile: null,
      hydrated: false,

      initUserStore: ({ auth, user, organization, staff, tokens }) =>
        set({
          auth,
          user,
          organization: organization ?? null,
          staff: staff ?? null,
          access: tokens.access,
          refresh: tokens.refresh,
        }),

      /**
       * Commits a LOGISTICS-scoped session. Deliberately does not touch
       * `staff`/`organization` — a Logistics login never carries either — so
       * a stale Staff session can't bleed into a Logistics one on the same
       * browser (`logoutAccount` already clears both on sign-out anyway).
       */
      initLogisticsStore: ({ auth, user, logistics, tokens }) =>
        set({
          auth,
          user,
          logistics,
          access: tokens.access,
          refresh: tokens.refresh,
        }),

      setAccess: (tokens) =>
        set({
          access: tokens.access,
          refresh: tokens.refresh,
        }),

      setAccount: ({ auth, user, organization }) =>
        set((state) => ({
          auth: auth ?? state.auth,
          user: user ?? state.user,
          organization: organization ?? state.organization,
        })),

      /**
       * The `admin/me` refetch landing.
       *
       * REPLACES rather than merges, and that is the whole reason it isn't `setAccount`. The response is
       * the server's complete answer about this operator, so a role they no longer hold or a display
       * name they just cleared has to disappear — a merge would preserve exactly the stale facts the
       * refetch exists to correct.
       *
       * `auth` is left ENTIRELY alone, and is the one thing that must be. It holds the email the
       * operator typed at sign-in, and no endpoint returns it — `admin/me` included — so there is
       * nothing here to refresh it from. Synthesising a blank one would be worse than leaving it null:
       * `operatorLabel` would then resolve to an empty string rather than falling through.
       *
       * `createdAt` from `memberSince`, because that is the name the API publishes for the column on
       * both this response and the login one. See `helpers/mfa.ts` for what dates off it.
       */
      syncOperatorAccount: (account) =>
        set({
          user: {
            userId: account.userId,
            publicId: account.publicId,
            username: account.username,
            status: account.status,
            verificationLevel: account.verificationLevel,
            createdAt: account.memberSince,
          },
          staff: account.staff,
          profile: account.profile,
        }),

      setProfile: (profile) => set({ profile }),

      setHydrated: () => set({ hydrated: true }),

      logoutAccount: () =>
        set({
          access: undefined,
          refresh: undefined,
          auth: null,
          user: null,
          organization: null,
          staff: null,
          logistics: null,
          profile: null,
        }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        access: state.access,
        refresh: state.refresh,
        auth: state.auth,
        user: state.user,
        organization: state.organization,
        staff: state.staff,
        logistics: state.logistics,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

/**
 * Await rehydration from `localStorage`. Use when imperative code (not a
 * component) needs the session before it acts.
 */
export function waitForHydration(): Promise<void> {
  if (useAuthStore.getState().hydrated) return Promise.resolve();

  return new Promise((resolve) => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.hydrated) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/** True once the store has rehydrated *and* an access token is present. */
export function isAuthenticated(): boolean {
  const { hydrated, access } = useAuthStore.getState();
  return hydrated && Boolean(access?.token);
}
