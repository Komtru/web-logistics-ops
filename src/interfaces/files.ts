import type { ISODateString } from '@/interfaces/common';

/**
 * M20's upload surface, as far as the console needs it.
 *
 * The shape is dictated by one design decision on the API side: **no file byte ever passes through the
 * Komtru backend.** The client asks for a signed ticket, uploads the bytes straight to Cloudinary, then
 * tells the backend the upload landed. That is why this is three calls rather than one multipart POST,
 * and why the middle one is the only request in the app that does not go through `services/base.ts`.
 */

/** The categories the console has a reason to upload. Widen when a screen actually needs it. */
export type FileCategory = 'PROFILE_PHOTO';

/**
 * Visibility is REQUIRED by the API and never inferred — a default would be an inference, and the
 * failure mode in the permissive direction is a private document served to the internet. Each category
 * only permits certain classes; `PROFILE_PHOTO` permits `PUBLIC` and nothing else.
 */
export type FileVisibility = 'PUBLIC';

/** What `PROFILE_PHOTO` accepts. Enforced by Cloudinary before the bytes are stored, not just here. */
export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface CreateUploadTicketPayload {
  category: FileCategory;
  visibility: FileVisibility;
  /** The browser's `File.type`. Must be one of the category's accepted types or the API 400s. */
  contentType: string;
}

/** `POST files/upload-url` → 201. */
export interface UploadTicket {
  /** The file's identity from this moment on — allocated before any byte exists. */
  fileId: string;
  cloudName: string;
  /** Cloudinary's endpoint. Cross-origin, and deliberately not behind the `/api` rewrite. */
  uploadUrl: string;
  /**
   * The signed form fields, to be posted verbatim alongside the file.
   *
   * Opaque on purpose: they include `api_key`, `signature`, `timestamp` and the format allow-list, and
   * Cloudinary rebuilds the string-to-sign from the parameters it recognises. Adding, renaming or
   * dropping one turns every upload into a 401, so this is passed through untouched.
   */
  params: Record<string, string>;
  /** The ceiling, enforced server-side at finalize — checking it here just saves a wasted upload. */
  maxBytes: number;
  /** How long the ticket stays spendable. */
  expiresAt: ISODateString;
}

/** `POST files/:id/finalize` → 200. */
export interface FinalizedFile {
  fileId: string;
  category: FileCategory;
  visibility: FileVisibility;
  contentType: string;
  /** Reconciled from Cloudinary, never from the client. */
  sizeBytes: number;
  finalizedAt: ISODateString;
}
