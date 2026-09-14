import type { ISODateString } from '@/interfaces/common';

/**
 * Types for the logistics portal's Team (POC) management screen —
 * `GET`/`POST /logistics/members`, `PATCH /logistics/members/:id`.
 *
 * REVISED against the real backend (`companyMember.service.ts`,
 * `memberInvitation.service.ts`, `controllers.ts`, `routes.ts` on
 * `feat/m2-logistics-packages`, plus the `user` details now attached to
 * each member row on `work/logistics`), replacing the earlier guessed
 * shapes.
 *
 * Confirmed, load-bearing facts that shape how the roster screen works:
 *
 * 1. `GET /logistics/members` returns `{ members: LogisticsCompanyMember[] }`
 *    — a bare array, no pagination envelope. There is no `page`/`limit`/
 *    `total` here, unlike packages.
 *
 * 2. A member row now carries a nested `user` object (`id`, `publicId`,
 *    `displayName`, `avatarUrl`, `email` (masked), `phone` (masked)) — the
 *    roster no longer needs to fall back to a raw `userId` label for any
 *    row that has an active account, which is every row here (see fact 3).
 *
 * 3. A person invited with NO existing Kumtru account never gets a member
 *    row at all — they get a `logistics_member_invitations` row instead,
 *    which is a completely separate table with no list endpoint. The
 *    `PENDING` outcome is visible exactly once, in the invite response
 *    itself, and cannot be shown on the roster afterward. This is a real,
 *    confirmed gap, not a frontend oversight — see the module's git history
 *    for `companyMember.service.ts`.
 */

export type LogisticsMemberRole = 'ADMIN' | 'OPERATOR';

export type LogisticsMemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';

/**
 * The account details attached to a member row. `displayName`/`avatarUrl`
 * are nullable since a user may not have set either; `email`/`phone` are
 * masked (e.g. `m•••@gmail.com`, `+234916•••8813`), never the raw value.
 */
export interface LogisticsMemberUserRef {
  id: string;
  publicId: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
}

/** One row of `GET /logistics/members` — exactly `LogisticsCompanyMemberView` server-side. */
export interface LogisticsCompanyMember {
  id: string;
  companyId: string;
  userId: string;
  user: LogisticsMemberUserRef;
  role: LogisticsMemberRole;
  status: LogisticsMemberStatus;
  invitedByUserId: string | null;
  invitedAt: ISODateString | null;
  acceptedAt: ISODateString | null;
  removedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface LogisticsMemberListParams {
  status?: LogisticsMemberStatus;
  [key: string]: string | number | boolean | null | undefined | Array<string | number> | undefined;
}

/** `GET /logistics/members`'s bare response body — no pagination envelope. */
export interface LogisticsMemberListResult {
  members: LogisticsCompanyMember[];
}

/**
 * `POST /logistics/members` body.
 *
 * `name` is accepted but NOT stored on the resulting member row — it exists
 * only as a note for the inviting admin's own reference (e.g. shown back to
 * them in the invite result), not persisted anywhere queryable later.
 */
export interface InviteLogisticsMemberPayload {
  email?: string;
  phone?: string;
  name?: string;
  role: LogisticsMemberRole;
}

export type LogisticsContactChannel = 'EMAIL' | 'PHONE';

export type LogisticsInvitationStatus = 'PENDING' | 'ACCEPTED' | (string & {});

/**
 * A `logistics_member_invitations` row — created instead of a member row
 * when the invited email/phone has no existing verified Kumtru account yet.
 * Exactly `LogisticsMemberInvitationView` server-side.
 */
export interface LogisticsMemberInvitation {
  id: string;
  companyId: string;
  role: LogisticsMemberRole;
  status: LogisticsInvitationStatus;
  contactChannel: LogisticsContactChannel;
  /** e.g. `j•••@example.com` — masked, never the raw address. */
  contactMasked: string;
  invitedByUserId: string | null;
  acceptedByUserId: string | null;
  acceptedAt: ISODateString | null;
  expiresAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * The two shapes `POST /logistics/members` always resolves to — never a 404.
 * `LINKED`: the address matched an existing verified account, a real member
 * row exists right now. `PENDING`: no account existed yet; access appears
 * automatically once they sign up and verify that exact address.
 */
export type InviteLogisticsMemberResult =
  | { outcome: 'LINKED'; member: LogisticsCompanyMember }
  | { outcome: 'PENDING'; invitation: LogisticsMemberInvitation };

/** `PATCH /logistics/members/:id` body — change a POC's role, or remove them. */
export interface UpdateLogisticsMemberPayload {
  role?: LogisticsMemberRole;
  status?: 'REMOVED';
}

/** `error.errorCode` values a `PATCH /logistics/members/:id` call can raise. */
export const LAST_ADMIN_ERROR_CODE = 'LAST_ADMIN';

/** `error.errorCode` values a `POST /logistics/members` call can raise, beyond validation errors. */
export const ALREADY_HAS_ACTIVE_COMPANY_ERROR_CODE = 'ALREADY_HAS_ACTIVE_COMPANY';
export const ALREADY_A_MEMBER_ERROR_CODE = 'ALREADY_A_MEMBER';
export const ALREADY_INVITED_PENDING_ERROR_CODE = 'ALREADY_INVITED_PENDING';
