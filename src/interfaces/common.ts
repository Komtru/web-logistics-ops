/** Pagination envelope returned by every list endpoint. */
export interface QueryResult<T = unknown> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

export interface ListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  search?: string;
}

/** ISO-8601 timestamp, kept nominal so we don't confuse it with free text. */
export type ISODateString = string;
