import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import queryString from 'query-string';

import type {
  IBlobResponse,
  IDelete,
  IGet,
  IPatch,
  IPost,
  IPostMultipart,
  IPut,
  QueryParams,
  RequestError,
} from '@/interfaces/IAxios';
import { clearClientSession, type IssuedTokens, toAccess } from '@/helpers/session';
import { useAuthStore } from '@/store/auth.store';

/**
 * The browser only ever talks to this origin; `next.config.ts` rewrites
 * `/api/:path*` to `NEXT_PUBLIC_BASE_URL`. No CORS, no baked-in backend host.
 */
const BASE_URL = '/api/';

/**
 * Every auth failure is a bare `401` with one message — `Invalid credentials.`
 * on login, `Your session is no longer valid. Sign in again.` on refresh. The
 * API deliberately publishes no machine-readable sub-code: a distinguishable
 * `REUSE_DETECTED` would tell an attacker their stolen token tripped the alarm.
 *
 * So the only signal available is the status itself. A 401 on a normal request
 * means "try refreshing once"; a 401 from the refresh means "the session is
 * gone". `_retry` is what keeps the first from looping into the second.
 */
const UNAUTHORIZED = 401;

/**
 * Where a dead session lands: the sign-in screen at `/`, carrying the reason.
 */
const LOGOUT_PATH = '/';

/**
 * Refresh tokens **rotate** — the response's token replaces the one sent, and
 * replaying a spent token revokes the whole family. Hence the single-flight
 * queue below is a correctness requirement, not just an optimisation.
 */
const REFRESH_PATH = 'auth/refresh';

/** Requests carry a `_retry` flag so a replayed request can't loop forever. */
type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function serializeQuery(query?: QueryParams): string {
  if (!query) return '';

  const qs = queryString.stringify(query, {
    skipNull: true,
    skipEmptyString: true,
    arrayFormat: 'comma',
  });

  return qs ? `?${qs}` : '';
}

function withQuery(url: string, query?: QueryParams): string {
  return `${url}${serializeQuery(query)}`;
}

/**
 * Drops the session, then leaves for the sign-in screen.
 *
 * Clearing first is load-bearing: the login page bounces anyone holding a token
 * straight back to the console, so leaving the dead tokens in place would
 * ping-pong the operator between the two until the next 401.
 *
 * Goes straight to `/` rather than through `/logout`: the session is already
 * dead server-side, so there is nothing left to revoke — only the same local
 * teardown that page performs.
 */
function hardRedirectToLogout(reason: string): void {
  clearClientSession();

  if (typeof window === 'undefined') return;
  window.location.href = `${LOGOUT_PATH}?reason=${reason}`;
}

/** Parses `filename="…"` (and RFC 5987 `filename*=`) out of content-disposition. */
function parseFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback;

  const utf8 = /filename\*=UTF-8''([^;\n]*)/i.exec(disposition);
  if (utf8?.[1]) return decodeURIComponent(utf8[1].trim());

  const plain = /filename="?([^";\n]*)"?/i.exec(disposition);
  if (plain?.[1]) return plain[1].trim();

  return fallback;
}

/* -------------------------------------------------------------------------- */
/* Single-flight token refresh                                                 */
/* -------------------------------------------------------------------------- */

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let failedQueue: QueuedRequest[] = [];

function flushQueue(error: unknown, token?: string): void {
  const queue = failedQueue;
  failedQueue = [];

  queue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
}

/**
 * Bare axios instance for the refresh call itself — deliberately free of
 * interceptors so a failing refresh can never re-enter this logic.
 */
const refreshClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

async function performRefresh(): Promise<string> {
  const refreshToken = useAuthStore.getState().refresh?.token;

  if (!refreshToken) {
    throw new Error('No refresh token available.');
  }

  const { data } = await refreshClient.post(REFRESH_PATH, {
    refreshToken,
  });

  // Identity endpoints answer `{ status, data }` with the tokens flat inside
  // `data`; unwrap the envelope if it's there, then normalise to the nested
  // pair the store holds.
  const issued: Partial<IssuedTokens> = data?.data ?? data ?? {};

  if (!issued.accessToken) {
    throw new Error('Refresh response did not contain an access token.');
  }

  // A refresh that rotates the refresh token replaces it; one that doesn't
  // leaves the caller's token in place rather than storing `undefined`.
  useAuthStore.getState().setAccess(
    toAccess({
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken ?? refreshToken,
      expiresIn: issued.expiresIn,
    }),
  );

  return issued.accessToken;
}

/**
 * N concurrent 401s trigger exactly one refresh call; everyone else waits on the
 * same promise and replays with the fresh token. With rotating refresh tokens a
 * second concurrent call would present an already-spent token and take down the
 * whole family, so this queue is doing real work.
 */
function refreshAccessToken(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  refreshPromise = performRefresh()
    .then((token) => {
      flushQueue(null, token);
      return token;
    })
    .catch((error) => {
      flushQueue(error);
      throw error;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

/* -------------------------------------------------------------------------- */
/* Interceptors — written once, attached to both instances                     */
/* -------------------------------------------------------------------------- */

function attachRequestInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    const alreadySet = Boolean(config.headers?.Authorization);

    if (!alreadySet && typeof window !== 'undefined') {
      const token = useAuthStore.getState().access?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  });
}

function attachResponseInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const response = error.response;
      const originalRequest = error.config as RetriableConfig | undefined;
      const status = response?.status;

      /**
       * Access tokens last 10 minutes, so a 401 mid-session is usually just
       * expiry. Try one refresh and replay; if that fails the session is
       * genuinely gone (idle timeout at 30min, absolute at 8h, or the
       * `sessions_epoch` kill switch) and the operator has to sign in again.
       *
       * Sign-in itself is exempt: a 401 from `auth/staff/login/*` is a bad code,
       * and there is no session to refresh or discard.
       */
      const isLoginAttempt = originalRequest?.url?.startsWith('auth/staff/login');

      if (status === UNAUTHORIZED && !isLoginAttempt && originalRequest) {
        if (originalRequest._retry) {
          hardRedirectToLogout('session_expired');
          return Promise.reject(response?.data ?? error);
        }

        originalRequest._retry = true;

        try {
          const token = await refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return instance(originalRequest);
        } catch {
          hardRedirectToLogout('session_expired');
          return Promise.reject(response?.data ?? error);
        }
      }

      // Always reject — including network/timeout errors where `response` is
      // undefined. Resolving `undefined` here would silently break callers.
      return Promise.reject(response?.data ?? normalizeTransportError(error));
    },
  );
}

function normalizeTransportError(error: AxiosError): RequestError {
  return {
    status: false,
    code: error.code,
    message:
      error.code === 'ECONNABORTED'
        ? 'The request timed out. Check your connection and try again.'
        : error.message || 'Network request failed. Check your connection and try again.',
  };
}

/* -------------------------------------------------------------------------- */
/* Facade                                                                      */
/* -------------------------------------------------------------------------- */

class HttpFacade {
  private readonly http: AxiosInstance;
  private readonly httpMultipart: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 60_000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    this.httpMultipart = axios.create({
      baseURL: BASE_URL,
      timeout: 120_000,
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    [this.http, this.httpMultipart].forEach((instance) => {
      attachRequestInterceptor(instance);
      attachResponseInterceptor(instance);
    });
  }

  async get<D>({ url, query, headers }: IGet): Promise<D> {
    const response = await this.http.get<D>(withQuery(url, query), { headers });
    return response.data;
  }

  async getBlob({ url, query, headers }: IGet): Promise<IBlobResponse> {
    const response = await this.http.get(withQuery(url, query), {
      headers,
      responseType: 'blob',
    });

    return {
      blob: response.data as Blob,
      filename: parseFilename(
        response.headers['content-disposition'] as string | undefined,
        'komtru-download',
      ),
      contentType:
        (response.headers['content-type'] as string | undefined) ?? 'application/octet-stream',
    };
  }

  async post<D>({ url, body, query, headers }: IPost): Promise<D> {
    const response = await this.http.post<D>(withQuery(url, query), body, { headers });
    return response.data;
  }

  /** Same as `post` but hands back the whole response (for headers/status). */
  async postEntire<D>({ url, body, query, headers }: IPost): Promise<AxiosResponse<D>> {
    return this.http.post<D>(withQuery(url, query), body, { headers });
  }

  async patch<D>({ url, body, query, headers }: IPatch): Promise<D> {
    const response = await this.http.patch<D>(withQuery(url, query), body, { headers });
    return response.data;
  }

  async put<D>({ url, body, query, headers }: IPut): Promise<D> {
    const response = await this.http.put<D>(withQuery(url, query), body, { headers });
    return response.data;
  }

  async delete<D>({ url, body, headers }: IDelete): Promise<D> {
    const response = await this.http.delete<D>(url, { headers, data: body });
    return response.data;
  }

  async upload<D>({ url, data, query, headers }: IPostMultipart): Promise<D> {
    const response = await this.httpMultipart.post<D>(withQuery(url, query), data, { headers });
    return response.data;
  }
}

/** The single HTTP entry point for the app. Only `*.services.ts` may import it. */
export const http = new HttpFacade();
