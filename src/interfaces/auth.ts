import type { ISODateString } from '@/interfaces/common';
import type { IOrganization } from '@/interfaces/organization';

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

export interface TokenPayload {
  token: string;
  /**
   * Absolute expiry, derived from the login response's `expiresIn`.
   *
   * Optional because the identity service only dates the access token — the
   * refresh token comes back as a bare opaque string.
   */
  expires?: ISODateString;
}

export interface Access {
  access: TokenPayload;
  refresh: TokenPayload;
}

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/*                                                                             */
/* Shapes here mirror what `auth/staff/login/verify` (and `auth/mfa/verify`)    */
/* actually return. Roles and permissions ARE now modelled: a STAFF-scoped      */
/* login response carries a `staff` block resolved fresh from live role        */
/* assignments (never from the token itself), and `config/menu.tsx` filters    */
/* the sidebar against `staff.permissions`.                                    */
/* -------------------------------------------------------------------------- */

/**
 * The identity the operator signed in as.
 *
 * Holds the email because the login response omits it — it's only ever what
 * the operator typed at step 1, and the console needs it to label the session.
 */
export interface IAuth {
  id: string;
  email: string;
}

/**
 * `(string & {})` on the unions below keeps autocomplete for the values the API
 * has actually been observed returning while still accepting ones it hasn't —
 * the identity service's full domain isn't documented here yet.
 */
export type StaffStatus = 'ACTIVE' | (string & {});

export type VerificationLevel = 'UNVERIFIED' | (string & {});

/**
 * The operator's resolved role/permission set, present on a STAFF-scoped
 * session response. Absent from `MfaChallenge` — no session exists yet to
 * resolve roles for — so callers read it only once `isMfaChallenge` says the
 * response is a real session.
 */
export interface StaffAccess {
  /** Role codes currently held, e.g. `['SUPPORT_AGENT']`. Empty is possible in
   *  principle but never in practice — a STAFF session cannot exist without one. */
  roles: string[];
  /** The full resolved permission set those roles confer, e.g. `['user.view', ...]`. */
  permissions: string[];
}

/** Operator record as the staff identity service returns it. */
export interface IUser {
  userId: string;
  /** Human-quotable operator reference, e.g. `KMT-U-6NVMGP`. */
  publicId: string;
  username: string | null;
  status: StaffStatus;
  verificationLevel: VerificationLevel;
  /**
   * When the account was created — the anchor for the MFA enrolment grace
   * window (`helpers/mfa.ts`).
   *
   * Optional because `respondWithLogin` does not send it yet. Absent, the grace
   * period can't be dated, so enrolment stays skippable but undated rather than
   * shutting a new operator out of the console. See `describeMfaGrace`.
   */
  createdAt?: ISODateString;
}

/* -------------------------------------------------------------------------- */
/* The operator's own account — `admin/me`                                     */
/*                                                                             */
/* A STAFF-scoped surface of its own, because neither existing endpoint could   */
/* answer "who am I": `me/` is CONSUMER-scoped and 403s a staff token, and      */
/* `admin/staff/:id` refuses self-dealing and so 403s your own id.              */
/* -------------------------------------------------------------------------- */

/** The editable half of an operator's account. */
export interface OperatorProfile {
  /** How the operator wants to be named across the console. `null` = not set. */
  displayName: string | null;
  /**
   * Ready to render, or `null` for no photo.
   *
   * Resolved server-side on every read rather than stored, because it is a signed Cloudinary URL. A
   * `PROFILE_PHOTO` is `PUBLIC` by upload policy, and a PUBLIC file gets a signed but **non-expiring**
   * delivery URL — which is why this is safe to persist alongside the rest of the session. Anything
   * with a real expiry would have to be re-read instead; see `avatarExpiresAt`.
   */
  avatarUrl: string | null;
  /** `null` for a PUBLIC file, meaning "does not expire" rather than "unknown". */
  avatarExpiresAt: ISODateString | null;
  /** The M20 file the photo came from, or `null` when it is a social provider's picture. */
  avatarFileId: string | null;
}

/**
 * `GET admin/me` — the whole session snapshot, re-read on every page load.
 *
 * Deliberately the same field names the login response uses (`memberSince`, not `createdAt`), because
 * both are written into one store and a divergence would blank the field on the first refetch.
 */
export interface OperatorAccount {
  userId: string;
  publicId: string;
  username: string | null;
  status: StaffStatus;
  verificationLevel: VerificationLevel;
  /** When the account was created — the anchor for the MFA grace window (`helpers/mfa.ts`). */
  memberSince: ISODateString;
  profile: OperatorProfile;
  /** Re-resolved per call from live role assignments, so a role granted mid-session lands here. */
  staff: StaffAccess;
}

/**
 * `PATCH admin/me/profile`. Both fields are optional and only what is **sent** changes — omitting a
 * key leaves it alone, sending `null` clears it.
 */
export interface UpdateOperatorProfilePayload {
  /** `null` or blank clears it; the API folds whitespace to `null`. Max 100 chars. */
  displayName?: string | null;
  /** A finalized `PROFILE_PHOTO` file id. `null` removes the photo. */
  avatarFileId?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Staff email-OTP login                                                       */
/*                                                                             */
/* Passwordless by default: step 1 mails a 6-digit code (5-minute lifetime, 5   */
/* attempts), step 2 redeems it. Step 2 answers 200 with *either* a session or  */
/* an MFA challenge, so callers must discriminate on `mfaRequired`.             */
/* -------------------------------------------------------------------------- */

/** Digits in a login code, and how long the operator has to type them. */
export const OTP_CODE_LENGTH = 6;
export const OTP_LIFETIME_MINUTES = 5;

export interface OtpRequestPayload {
  email: string;
}

export type ClientPlatform = 'WEB' | 'IOS' | 'ANDROID';

export interface OtpVerifyPayload {
  email: string;
  code: string;
  platform?: ClientPlatform;
  deviceFingerprint?: string;
}

/**
 * Envelope the identity endpoints use. Distinct from `IResponse`: `status` is
 * the string `'success'` here, not a boolean.
 */
export interface AuthEnvelope<D> {
  status: 'success' | 'error';
  data: D;
}

/**
 * Step 1's whole response — a bare acknowledgement, no `data`.
 *
 * It is byte-identical for a real operator, a consumer, an unknown address and
 * a throttled one: a `challengeId` could only exist for an account that does,
 * so returning one would answer "is this an admin address?" for anyone asking.
 * That's why step 2 is keyed on the email rather than on a challenge id.
 */
export interface AuthAck {
  status: 'success';
  message: string;
}

/**
 * What the API wants doing next. `null` means sign-in is complete.
 *
 * `auth/mfa/verify` widens this: step 2 only ever answers `ENROL_MFA`, but the
 * MFA leg runs the full profile-completeness check and can also return
 * `CHANGE_PASSWORD` (a forced rotation) or `SET_PASSWORD`/`CHOOSE_USERNAME`/
 * `ADD_SECOND_CHANNEL` from `computeNextStep`.
 */
export type StaffLoginNextStep =
  'ENROL_MFA' | 'CHOOSE_USERNAME' | 'ADD_SECOND_CHANNEL' | 'SET_PASSWORD' | 'CHANGE_PASSWORD';

/**
 * A session, as issued by `auth/staff/login/verify` or `auth/mfa/verify`.
 *
 * Tokens arrive flat; the nested `{ access, refresh }` pair the store and the
 * `Bearer` interceptor hold is derived by `toAccess` in `helpers/session.ts`.
 * There is no organization — staff sign-in is tenant-agnostic.
 */
export interface StaffSession {
  accessToken: string;
  /**
   * Also set as an HttpOnly cookie scoped to `Path=/v1/auth`. That path is
   * invisible to this app (the browser only ever sees `/api/...`, which
   * `next.config.ts` rewrites), so refresh uses this body value.
   */
  refreshToken: string;
  /** Access-token lifetime in seconds (600). */
  expiresIn: number;
  tokenType: string;
  user: IUser;
  nextStep: StaffLoginNextStep | null;
  /** Present whenever `session.scope === 'STAFF'` — which is every session this
   *  console ever issues, since there is no consumer sign-in here. */
  staff?: StaffAccess;
}

export type MfaFactorType = 'TOTP' | 'SMS_OTP' | 'EMAIL_OTP' | 'PASSKEY' | (string & {});

export interface MfaFactor {
  id: string;
  type: MfaFactorType;
  /** Operator-facing description, e.g. "Phone ending 1187". */
  hint: string;
  isDefault: boolean;
}

/**
 * The other 200 from step 2, returned when the account has any active factor —
 * demanded even where the deployment minimum wouldn't require one, because
 * enrolling was an affirmative act.
 */
export interface MfaChallenge {
  mfaRequired: true;
  /** Single-use, 5-minute lifetime. Spend it on `auth/mfa/verify`. */
  mfaToken: string;
  factors: MfaFactor[];
}

/** Step 2's two possible 200 bodies. Discriminate with `isMfaChallenge`. */
export type StaffLoginResponse = StaffSession | MfaChallenge;

/**
 * Body for `POST auth/mfa/verify`, redeeming a challenge for a session.
 *
 * The `mfaToken` is consumed by the *attempt*, not by success: the service reads
 * it with an atomic GETDEL before it ever checks the code. So a wrong code
 * leaves nothing to retry with — see `MfaChallengeForm`.
 */
export interface MfaVerifyPayload {
  /** From the challenge. Single-use, 5-minute lifetime. */
  mfaToken: string;
  /** Which factor is being answered — an `id` from `MfaChallenge.factors`. */
  factorId: string;
  /**
   * 6 digits for TOTP. The API accepts 6–20 so a recovery code fits, but
   * recovery factors are filtered out of `factors`, leaving the console no
   * `factorId` to send one against.
   */
  code: string;
  /**
   * Required by `SMS_OTP` / `EMAIL_OTP`, and unobtainable: the service function
   * that sends their code has no route mounted, so nothing can issue one. Those
   * factor types are therefore unusable at login — see `usableLoginFactors`.
   */
  challengeId?: string;
}

/* -------------------------------------------------------------------------- */
/* TOTP enrolment                                                              */
/*                                                                             */
/* Two steps, because a seed the operator never stored is worse than no factor  */
/* at all: `enroll` mints a PENDING factor and hands back the secret once,      */
/* `activate` proves the authenticator holds it. Only TOTP is offered — the     */
/* API also supports SMS and email factors, but email OTP is already how staff  */
/* sign in, so an email factor would repeat the channel instead of adding one.  */
/* -------------------------------------------------------------------------- */

export interface TotpEnrolPayload {
  /** Shown in the operator's factor list. Max 60 chars; API defaults it. */
  label?: string;
}

/** `POST me/mfa/totp/enroll` → 201. */
export interface TotpEnrolment {
  factorId: string;
  /**
   * Base32 seed, for manual entry when a camera isn't available.
   *
   * Returned exactly once — it is encrypted at rest and no endpoint reads it
   * back — so it must not be discarded until the factor is active.
   */
  secret: string;
  /** `otpauth://totp/...`, rendered as the QR code. */
  otpauthUri: string;
}

export interface TotpActivatePayload {
  factorId: string;
  /** 6 digits from the authenticator. */
  code: string;
}

/** `POST me/mfa/totp/activate` → 200. */
export interface ActivatedFactor {
  id: string;
  type: MfaFactorType;
  status: 'ACTIVE' | (string & {});
}

/* -------------------------------------------------------------------------- */
/* Logistics identifier+password login                                       */
/*                                                                             */
/* A third session scope alongside CONSUMER and STAFF (M2 spec, §2). Unlike   */
/* Staff's two-step OTP flow, `POST auth/logistics/login` is single-step:     */
/* identifier (email or phone) + password verified and a session issued in   */
/* one call — mirroring `auth/staff/login`'s structure server-side, not its  */
/* OTP UX. Gated on an active row in `logistics_company_members`: no active  */
/* membership answers `403 NO_LOGISTICS_ACCESS` even when the credentials    */
/* are entirely valid for the person's regular Kumtru account — this        */
/* endpoint is about portal eligibility, not identity.                       */
/* -------------------------------------------------------------------------- */

export interface LogisticsLoginPayload {
  /** Email or phone — the backend looks the account up by either. */
  identifier: string;
  password: string;
  platform?: ClientPlatform;
  deviceFingerprint?: string;
}

export type LogisticsPocRole = 'ADMIN' | 'OPERATOR' | (string & {});

/**
 * The caller's resolved company membership on a LOGISTICS-scoped session.
 * Mirrors `principal.service.ts`'s `Principal.companyMembership` server-side —
 * re-resolved fresh on every request, never cached on the token itself, so a
 * role change or removal takes effect on the caller's next request, not just
 * their next login. The console only ever holds the snapshot from the login
 * response.
 */
export interface LogisticsAccess {
  companyId: string;
  companyName: string;
  role: LogisticsPocRole;
}

/**
 * A session, as issued by `POST auth/logistics/login`.
 *
 * Tokens arrive flat, same shape `StaffSession` uses — `toAccess` in
 * `helpers/session.ts` derives the nested `{ access, refresh }` pair the
 * store and the `Bearer` interceptor hold.
 */
export interface LogisticsSession {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  tokenType: string;
  user: IUser;
  /**
   * Present on every LOGISTICS-scoped session — there is no such thing as one
   * without an active company membership, since that's exactly what this
   * endpoint gates on (`403 NO_LOGISTICS_ACCESS` otherwise).
   */
  logistics: LogisticsAccess;
}

/* -------------------------------------------------------------------------- */
/* Sign-out                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Body for `POST auth/logout`, which needs the access token *and* answers 204 —
 * there is no response to model.
 */
export interface LogoutPayload {
  /**
   * The API also accepts the refresh token as an HttpOnly cookie, but that is
   * scoped to `Path=/v1/auth` and therefore invisible through the `/api`
   * rewrite. Sending it in the body is what lets the server revoke the exact
   * refresh row rather than only the access session.
   */
  refreshToken?: string;
  /**
   * Revoke every session on the account instead of just this one. Distinct
   * audit outcome server-side (`USER_LOGOUT_ALL`), so it isn't a UI nicety.
   */
  allDevices?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Store contract                                                              */
/* -------------------------------------------------------------------------- */

interface authStore {
  access?: TokenPayload;
  refresh?: TokenPayload;
  auth: IAuth | null;
  user: IUser | null;
  organization: IOrganization | null;
  /** `null` before the first STAFF session lands, or once signed out. */
  staff: StaffAccess | null;
  /**
   * `null` before the first LOGISTICS session lands, or once signed out.
   * Mutually exclusive with `staff` in practice — a browser session is
   * signed in as one scope at a time — but both are modelled independently
   * since nothing enforces that at the type level.
   */
  logistics: LogisticsAccess | null;
  /**
   * `null` until `admin/me` has been read once — the login response carries no profile.
   *
   * So the first paint after a sign-in shows initials and the username, and the avatar and display name
   * appear a moment later. Persisted, so that only happens once per browser rather than once per load.
   */
  profile: OperatorProfile | null;
  hydrated: boolean;
}

export interface IAuthStore extends authStore {
  /**
   * `organization` is optional: staff sign-in doesn't return a tenant, so the
   * console starts with none and whatever sets one does it later.
   */
  initUserStore: (payload: {
    auth: IAuth;
    user: IUser;
    organization?: IOrganization | null;
    staff?: StaffAccess | null;
    tokens: Access;
  }) => void;
  /**
   * Commits a LOGISTICS-scoped session (`POST auth/logistics/login`) to the
   * store. Kept separate from `initUserStore`, for the same reason Staff
   * sign-in is its own endpoint rather than a flag (M2 spec §2, control C2):
   * keeping the two commit paths distinct makes it structurally clear which
   * scope a session came from, and means a Logistics login can never
   * accidentally populate `staff` or vice versa.
   */
  initLogisticsStore: (payload: {
    auth: IAuth;
    user: IUser;
    logistics: LogisticsAccess;
    tokens: Access;
  }) => void;
  setAccess: (tokens: Access) => void;
  setAccount: (payload: { auth?: IAuth; user?: IUser; organization?: IOrganization }) => void;
  /**
   * Overwrites the session facts from a fresh `admin/me` read.
   *
   * Distinct from `setAccount`, which merges and skips `undefined`. This one **replaces**, because the
   * server is the authority on every field it sends: merging would keep a role the operator no longer
   * holds and a display name they just cleared.
   */
  syncOperatorAccount: (account: OperatorAccount) => void;
  /** The narrower write, for a profile edit that must not touch roles or identity. */
  setProfile: (profile: OperatorProfile) => void;
  setHydrated: () => void;
  logoutAccount: () => void;
}
