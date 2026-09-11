/**
 * Argument shapes for the HTTP facade in `@/services/base`.
 * Every facade method takes exactly one object argument.
 */

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | Array<string | number>
>;

export type Headers = Record<string, string>;

/** Base shape — `delete` needs a body often enough to sit at the root. */
export interface IDelete {
  url: string;
  body?: unknown;
  headers?: Headers;
}

export interface IPost extends IDelete {
  query?: QueryParams;
}

export type IPatch = IPost;
export type IPut = IPost;

export interface IGet {
  url: string;
  query?: QueryParams;
  headers?: Headers;
}

export interface IPostMultipart {
  url: string;
  data: FormData;
  query?: QueryParams;
  headers?: Headers;
}

/** Standard success envelope returned by the Komtru API. */
export interface IResponse<D> {
  status: boolean;
  message: string;
  data: D;
}

/**
 * Standard error envelope. Callers read `err.message` — it is the only field
 * the API guarantees, and auth failures deliberately carry one uniform message.
 *
 * `code` is the HTTP status as a **number** on API errors (`{ status: "error",
 * code: 401, message }`); it is a string only for transport failures, where
 * axios supplies its own (`ECONNABORTED`).
 */
export interface RequestError {
  status: false | 'error';
  code?: number | string;
  message: string;
  errors?: Record<string, string[]>;
  /**
   * Machine-readable error identifier the API sends alongside `message` for
   * errors a caller needs to branch on specifically — e.g. `NO_LOGISTICS_ACCESS`
   * (`POST auth/logistics/login`), `LAST_ADMIN`, `ALREADY_HAS_ACTIVE_COMPANY`.
   * Optional because most endpoints don't send one — Staff auth failures
   * deliberately don't, since a distinguishable code would tell an attacker
   * their stolen token tripped the alarm — so this is opt-in per error, not
   * a contract every endpoint must fill.
   */
  errorCode?: string;
}

/** A downloaded blob plus the filename parsed from `content-disposition`. */
export interface IBlobResponse {
  blob: Blob;
  filename: string;
  contentType: string;
}
