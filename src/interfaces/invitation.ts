/**
 * The invitee's half of staff invitation acceptance — unauthenticated, the
 * token is the credential. Shapes below are quoted verbatim from
 * `backend-apis/docs/api/staff-invitations.md` ("Invitee endpoints"), cross-
 * checked against `staffInvitation.controller.ts` / `.service.ts` — not
 * guessed.
 */

export interface InvitationPreview {
  /** Masked — `o•••@komtru.com`. The invitee already knows their own address. */
  email: string;
  roleCode: string;
  roleName: string;
  displayName: string | null;
  /** Falls back to "A Komtru administrator" server-side rather than leak a public id. */
  inviterDisplayName: string;
  expiresAt: string;
}

export interface RequestInvitationOtpResult {
  maskedEmail: string;
  expiresInSeconds: number;
}

export interface AcceptInvitationPayload {
  token: string;
  /** Exactly 6 digits. */
  code: string;
  deviceFingerprint?: string;
  platform?: 'WEB' | 'IOS' | 'ANDROID';
}

/**
 * `userSummary()`'s shape — the SAME one `auth/staff/login/verify` sends,
 * with `memberSince` (not `createdAt`) for the account's creation date.
 */
export interface AcceptedInvitationUser {
  userId: string;
  publicId: string;
  username: string | null;
  status: string;
  verificationLevel: string;
  memberSince: string;
}

export interface AcceptInvitationResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: AcceptedInvitationUser;
  roleCode: string;
  /** Always `ENROL_MFA` — `grantRole` sets `mfa_required` and a fresh account has no factor. */
  nextStep: 'ENROL_MFA';
}
