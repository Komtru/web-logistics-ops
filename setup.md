# Seed Prompt — Next.js 15 App Scaffold (LegalCon-style architecture)

Copy everything below the line into a fresh Claude Code session in an empty directory.
Replace the values in **Project inputs** first; everything else is derived from them.

---

You are scaffolding a brand-new production-ready Next.js web UI. Follow this spec exactly. Do not add
libraries, tests, or abstractions that are not listed. Build the full skeleton, then verify it compiles.

## 1. Project inputs (fill these in before starting)

| Input | Value |
| --- | --- |
| `APP_NAME` | e.g. `Acme` (human-readable brand) |
| `APP_SLUG` | e.g. `acme` (lowercase, used for CSS token prefix, store name, pm2 app name) |
| `PACKAGE_NAME` | e.g. `acme-ui` |
| `DEV_PORT` | e.g. `7812` |
| `API_BASE_URL` | dev backend origin + version prefix, e.g. `http://localhost:7813/v1` |
| `BRAND_COLORS` | dark/navy, primary accent, highlight accent, warm accent (hex) |
| `PRIMARY_FONT` | a `next/font/google` family, e.g. `Outfit` |
| `TAGLINE` / `DESCRIPTION` | used in metadata |
| `DOMAIN_ENTITIES` | the tenant/org concept and its enums (e.g. `Firm`, `Workspace`, `Org`) |

Everywhere below, `{slug}` means `APP_SLUG`.

## 2. Stack (pin these choices)

- **Next.js 15.5.x, App Router, Turbopack** (`next dev --turbopack`, `next build --turbopack`), React 19.1, TypeScript strict.
- **Tailwind CSS v4** via `@tailwindcss/postcss` — **CSS-first config, no `tailwind.config.ts`**. Design tokens live in `@theme` inside `src/app/globals.css`.
- **shadcn/ui** (`style: new-york`, `rsc: true`, `baseColor: neutral`, `cssVariables: true`) on Radix primitives + `class-variance-authority` + `clsx` + `tailwind-merge`.
- **TanStack Query v5** for all server state; **Zustand v5 (persist)** for client/session state. Never duplicate server data into Zustand except auth session.
- **Axios** wrapped in a single HTTP facade class; **`query-string`** for query serialization.
- **Formik + Yup** for forms (Yup is the form validator; `zod` may be installed for non-form parsing but is not the form layer).
- **framer-motion** page/element animation, **lucide-react** icons, **sonner** toasts, **nextjs-toploader** route progress, **next-themes** dark mode.
- **pnpm** as package manager. **pm2** for prod process management.

### Dependencies to install

```
next@15.5.2 react@19.1.0 react-dom@19.1.0
@tanstack/react-query @tanstack/react-table
axios query-string
zustand nookies
formik yup zod
@radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-dialog
@radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover
@radix-ui/react-progress @radix-ui/react-scroll-area @radix-ui/react-select
@radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip
class-variance-authority clsx tailwind-merge
lucide-react framer-motion next-themes nextjs-toploader sonner
date-fns luxon react-day-picker recharts
react-dropzone react-phone-number-input react-google-recaptcha
use-debounce uuid
```

Dev: `typescript @types/node @types/react @types/react-dom @types/luxon @types/uuid @types/react-google-recaptcha tailwindcss @tailwindcss/postcss postcss autoprefixer tw-animate-css prettier prettier-plugin-tailwindcss @tanstack/react-query-devtools`

Add only when the feature is actually needed: `@tiptap/*` + `tippy.js` (rich text), `sharedb` + `reconnecting-websocket` (realtime docs), `@giphy/*` (media picker).

## 3. Directory structure

```
src/
  app/
    layout.tsx                  # root: metadata, providers, Toaster, top loader
    globals.css                 # Tailwind v4 @theme tokens + base vars + app CSS
    fonts.ts                    # next/font/google exports as a `fonts` object
    (marketing)/
      layout.tsx                # floating navbar + footer
      page.tsx                  # -> LandingPage.tsx
      LandingPage.tsx
      privacy/page.tsx
      terms/page.tsx
    (authentication)/
      layout.tsx                # split-screen shell + footer
      auth/
        login/page.tsx
        register/page.tsx
        register/success/page.tsx
        forgot-password/page.tsx
        verify/page.tsx         # email verification via ?token=
        logout/page.tsx         # clears store + storage, redirects
        2fa/page.tsx            # login challenge (?challenge&email&method)
        2fa/setup/page.tsx      # method chooser
        2fa/setup/app/page.tsx  # authenticator: QR + secret
        2fa/setup/email/page.tsx
    (dashboard)/
      dashboard/layout.tsx      # SidebarProvider + AppSidebar + Topbar + main
      dashboard/page.tsx
  components/
    ui/                         # shadcn primitives ONLY (generated, then themed)
    general/                    # app-specific composed components
      marketing-navbar.tsx
      dashboard/Sidebar.tsx
      dashboard/Topbar.tsx
    forms/                      # reusable form widgets/dialogs
    query-provider.tsx
    theme-provider.tsx
  config/menu.tsx               # nav structure / role-based menu
  helpers/                      # pure functions (delay, numbers, timezones)
  hooks/                        # use-mobile, useCustomToast, useRowLoading, useDeviceTimeZone
  interfaces/                   # IAxios.ts, auth.ts, <tenant>.ts, per-domain types
  lib/react-query.ts            # QueryClient singleton
  lib/utils.ts                  # cn()
  services/base.ts              # HttpFacade (single axios wrapper)
  services/<domain>.services.ts # React Query hooks per domain
  store/                        # zustand stores: auth.store.ts, sidebar.store.ts, ...
  middleware.ts
public/
  icons/ (favicon set, apple-touch, android-chrome 192/512), site.webmanifest,
  og-<slug>.png, <slug>.light.png, <slug>.dark.png
```

Root files: `next.config.ts`, `tsconfig.json`, `components.json`, `postcss.config.mjs`,
`pnpm-workspace.yaml`, `ecosystem.config.json`, `.env.local`, `.env.example`, `.gitignore`, `README.md`.

## 4. Architectural rules (the important part)

### 4.1 API access — proxy + single facade

- `next.config.ts` rewrites `/api/:path*` → `${process.env.NEXT_PUBLIC_BASE_URL}/:path*`. The browser
  therefore **only ever calls same-origin `/api/...`** — no CORS, backend URL swappable per env.
- `src/services/base.ts` exports a **singleton instance** of a `HttpFacade` class with `baseURL = "/api/"`.
  It holds two axios instances: `http` (JSON) and `httpMultipart` (`multipart/form-data`).
- Facade methods take a single object arg, return `response.data`:
  `get({url, query, headers})`, `getBlob({url, query, headers})` (parses `content-disposition` filename),
  `post({url, body, query, headers})`, `postEntire(...)` (returns full response), `patch`, `put`,
  `delete({url, body, headers})`, `upload({url, data: FormData, headers})`.
  Query strings are serialized with `query-string`.
- Arg shapes live in `src/interfaces/IAxios.ts`: `IDelete` (base: `url`, `body?`, `headers?`), `IPost extends IDelete` (+`query`), `IPatch = IPost`, `IPut = IPost`, `IGet`, `IPostMultipart` (`data: FormData`), plus `IResponse<D>` and `RequestError`.

### 4.2 Auth interceptors (implement carefully — the reference repo is buggy here)

Request interceptor: if no `Authorization` header is already set and `typeof window !== "undefined"`,
read `useAuthStore.getState().access?.token` and set `Bearer` — apply to **both** axios instances.

Response interceptor (both instances share one implementation — write it once and attach twice):

1. On error, inspect `error.response`.
2. If the API signals a revoked token, hard-redirect to `/auth/logout?code=access_revoked`.
3. If it signals an expired access token and `!originalRequest._retry`: set `_retry = true`, refresh
   via a **single-flight queue** (module-scoped `isRefreshing` + `refreshPromise` + `failedQueue`), so N
   concurrent 401s trigger exactly one `POST /auth/refresh-tokens`; queued requests resolve with the new
   token and replay. On refresh failure → `/auth/logout?code=access_revoked`.
4. Otherwise `Promise.reject(error.response?.data ?? error)` — **always reject, even when `response` is
   undefined** (network errors must not resolve to `undefined`).
5. Detect expiry/revocation by **HTTP status + a stable error code**, not by matching message strings.
   Keep the codes in one exported const.
6. No `debugger` statements, no `console.log` of every error.

Callers therefore always `catch (err) => err.message` from the API error envelope.

### 4.3 Server state — TanStack Query

- `src/lib/react-query.ts`: lazily-created module singleton `getQueryClient()` with
  `defaultOptions.queries = { staleTime: 30_000, refetchOnWindowFocus: false }`.
- `src/components/query-provider.tsx`: `"use client"`, wraps children in `QueryClientProvider` +
  `Suspense` fallback + `ReactQueryDevtools initialIsOpen={false}`.
- **Every** network call is exposed as a hook in `src/services/<domain>.services.ts`, typed
  `useMutation<Result, string, Payload>` / `useQuery<Result>`, whose `mutationFn`/`queryFn` calls `http.*`.
  Components never import `axios` or `http` directly. Name hooks `use<Verb><Noun>`.
- Give queries structured, exported query keys (`authKeys.me()`), and invalidate via the client from
  `getQueryClient()` after mutations.

### 4.4 Client state — Zustand

- `src/store/auth.store.ts`: `create<IAuthStore>()(persist(..., { name: "{slug}-auth-store", storage: createJSONStorage(() => localStorage), onRehydrateStorage: () => (s) => s?.setHydrated() }))`.
- State: `access?: TokenPayload`, `refresh?: TokenPayload`, `auth: IAuth | null`, `user: IUser | null`,
  `<tenant>: I<Tenant> | null`, `hydrated: boolean`.
  Actions: `initUserStore({auth, user, <tenant>, tokens})`, `setAccess`, `setAccount`, `setHydrated`,
  `logoutAccount()` (clears everything).
- The store interface (`IAuthStore extends authStore`) lives in `src/interfaces/auth.ts`, not in the store file.
- Small UI state gets its own tiny non-persisted store (`sidebar.store.ts`).
- Because auth lives in `localStorage`, gate anything auth-dependent on `hydrated` to avoid hydration
  mismatch. Provide a `waitForHydration()` helper if a caller needs to await it.

### 4.5 Routing & layouts

- Three route groups, three shells: `(marketing)` dark hero + floating pill navbar, `(authentication)`
  split screen (brand panel left, form column right, shared footer), `(dashboard)` sidebar + topbar +
  white rounded content surface.
- Group layouts apply the brand font via `${fonts.<primary>.className}` and wrap children in
  `AnimatePresence`.
- `src/middleware.ts` exists with `config.matcher = ["/auth/:path*", "/dashboard/:path*"]`. Keep it a
  pass-through (`NextResponse.next()`) unless/until tokens are also stored in cookies — client-side
  `localStorage` tokens are invisible to middleware, so **do not pretend to guard routes there**. Do
  client-side redirects in the dashboard layout based on `hydrated && access`.

### 4.6 Styling & theming

- `globals.css` starts with `@import "tailwindcss";` then `@import "tw-animate-css";`.
- Brand palette in `@theme` as `--color-{slug}-<name>` (navy, blue/primary, cyan/highlight, gold,
  gray, `slate-50..900`, charcoal) → auto-generates `bg-{slug}-navy`, `text-{slug}-slate-500`, etc.
  **Use these token classes throughout; no raw hex in components.**
- `@layer base` defines shadcn sidebar CSS vars for `:root` and `.dark`.
- `ThemeProvider` = `next-themes` with `attribute="class" defaultTheme="system" enableSystem`. Every
  color choice must have a dark-mode counterpart.
- Generate shadcn primitives with the CLI, then re-theme variants in place (e.g. `Button`'s `default`
  variant uses the brand accent; add an `xl` size). Keep `components/ui` free of app logic.
- Custom composites worth building up front: `FloatingLabelInput` (peer/placeholder-shown float label,
  wraps `Input`), `Spinner`, `DatePicker`, `MultiSelect`.
- Do **not** create `tailwind.config.ts`. (The reference repo has a stale `tailwind.config445.ts` — an
  artifact, not the source of truth.)

### 4.7 Forms

Formik + Yup, one `Yup.object({...})` schema per page above the component:

```tsx
<Formik<LoginPayloadInterface> initialValues={...} validationSchema={LoginSchema} onSubmit={handleSubmit}>
  {({ isSubmitting }) => (
    <Form className="space-y-5">
      <Field name="email" type="email" as={FloatingLabelInput} label="Email" required />
      <ErrorMessage name="email" component="span" className="text-sm text-red-600" />
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : "Sign In"}</Button>
    </Form>
  )}
</Formik>
```

`handleSubmit` calls the service's `mutateAsync`, sets a local `error` string in `catch`, and clears
`setSubmitting(false)` in `finally`. Show API errors both inline and via `useCustomToast`.

### 4.8 Feedback

`src/hooks/useCustomToast.tsx` returns a memoized `showToast({title, description?, type?, duration?})`
using `sonner`'s `toast.custom`, with per-type icon (`Info`/`CheckCircle2`/`AlertTriangle`/`CircleX`)
and a colored left border from a `colorMap`. Mount `<Toaster />` (the shadcn `sonner` wrapper, theme-aware)
in the root layout, plus `<NextTopLoader showSpinner={false} color="<primary accent>" />`.

### 4.9 Types

- One file per domain in `src/interfaces/`. Enums as `string` enums (`AccountRoleEnum`, `AccountStatusEnum`,
  `<Tenant>PlanEnum`, `<Tenant>StatusEnum`).
- Model auth as three linked entities: `IAuth` (credentials, provider, `verified`, `twoFactor`),
  `IUser` (profile, prefs), `I<Tenant>` (org/tenant, `slug`, `plan`, `status`, `settings`).
- Discriminated unions for branching results — e.g.
  `LoginResultInterface = { requires2FA: true; challengeId; auth; user; <tenant> } | { requires2FA: false; auth; user; <tenant>; tokens: Access }`
  and `TwoFactorInitResult = {method:"authenticator"; qrDataURL; secret; message} | {method:"email"; message}`.
- Pagination envelope: `QueryResult { page, limit, totalPages, totalResults }`.
- Tokens: `TokenPayload { token, expires }`, `Access { access, refresh }`.

## 5. Auth feature surface to implement

Endpoints (all through the `/api` proxy): `POST /auth/login`, `/auth/create-account`, `/auth/logout`,
`/auth/refresh-tokens`, `/auth/send-verification-email`, `/auth/verify-email`, `/auth/forgot-password`,
`/auth/reset-password`, `/auth/verify-login-2fa`, `/auth/resend-login-2fa`, `POST /users/two-factor/init`,
`POST /users/two-factor/finish`.

Flows:

1. **Login** → if `requires2FA`, push `/auth/2fa?challenge=…&email=…&method=…`; else `initUserStore(...)` and go to `/dashboard`.
2. **2FA challenge** — 6-digit code (`/^\d{6}$/`), resend with cooldown, redirect to `/auth/login` if the challenge param is missing.
3. **2FA setup** — chooser → authenticator (render `qrDataURL`, show copyable secret) or email; confirm with `finish`.
4. **Register** → `/auth/register/success` prompting email verification; `/auth/verify?token=` completes it.
5. **Forgot / reset password**.
6. **Logout** — dedicated page: clear store, `localStorage`, `sessionStorage`, toast, `router.replace("/auth/login")`; honor `?code=access_revoked` in the message.

## 6. Config files

- `tsconfig.json`: strict, `target ES2017`, `moduleResolution: bundler`, `jsx: preserve`, `plugins: [{name:"next"}]`, `paths: { "@/*": ["./src/*"] }`. **Always import via `@/`.**
- `next.config.ts`: `images.remotePatterns` for your CDN/S3 hosts + the `/api/:path*` rewrite.
- `components.json`: shadcn config as in §2 with aliases `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`.
- `postcss.config.mjs`: `{ plugins: { "@tailwindcss/postcss": {} } }`.
- `pnpm-workspace.yaml`: `onlyBuiltDependencies: ['@tailwindcss/oxide', 'sharp']`.
- `ecosystem.config.json`: pm2 app named `{slug}-ui`, script `node_modules/next/dist/bin/next`,
  `node_args: "start -p <DEV_PORT>"`, `NODE_ENV=production`. **Keep the port and app name consistent
  with `package.json`** (the reference repo drifted here).
- `package.json` scripts: `dev: next dev -p <DEV_PORT> --turbopack`, `build: next build --turbopack`,
  `start:prod: next start -p <DEV_PORT>`, `start: pm2 start ecosystem.config.json --only {slug}-ui && pm2 save`.
- `.env.local` **and a committed `.env.example`** with: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_WS_BASE_URL`,
  `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, plus any third-party keys. `.gitignore` must
  ignore `.env*` (and un-ignore `.env.example`). **Never commit real keys** — the reference repo committed
  a `.env.local`; don't repeat that.
- Prettier with `prettier-plugin-tailwindcss` configured in `.prettierrc`.
- Root `layout.tsx` metadata: `metadataBase` from `NEXT_PUBLIC_APP_URL` → `VERCEL_URL` → localhost
  fallback; title/description/keywords, icon set, `manifest: "/site.webmanifest"`, OpenGraph + Twitter
  `summary_large_image` with absolute OG image URL.
- `README.md`: real setup docs (prereqs, env vars, `pnpm dev`, structure overview, deploy), not the CRA boilerplate.

## 7. Conventions

- `"use client"` only where hooks/interactivity are needed; layouts and static pages stay server components.
  (Note: `AnimatePresence` in a layout forces it client-side — either mark it or move the animation into a client child.)
- File naming: `kebab-case.tsx` in `components/ui` and `components/general` roots, `PascalCase.tsx` for
  composed feature components, `camelCase.ts` for hooks/helpers, `<domain>.services.ts`, `<domain>.store.ts`.
- Compose classes with `cn()`; never string-concat conditional classes.
- Use `next/image` for real assets (and add the host to `remotePatterns`); plain `<img>` only for local SVG/PNG logos.
- No `any` in new code — the reference repo leans on it for Formik helpers; type those as `FormikHelpers<T>`.

## 8. Build order

1. `pnpm create next-app` (TS, App Router, no src-dir default → then move to `src/`), install deps, write configs.
2. `globals.css` tokens + `fonts.ts` + root layout with providers/toaster/top-loader.
3. `lib/utils.ts`, `lib/react-query.ts`, `interfaces/IAxios.ts`, `services/base.ts` (facade + refresh queue).
4. `interfaces/auth.ts` + `interfaces/<tenant>.ts` + `store/auth.store.ts`.
5. shadcn primitives (`button card input label dialog dropdown-menu select checkbox tabs tooltip popover
   separator sheet sidebar skeleton table textarea scroll-area progress collapsible calendar badge accordion sonner`),
   then re-theme; add `FloatingLabelInput`, `Spinner`, `DatePicker`, `MultiSelect`.
6. `hooks/` + `helpers/` + `config/menu.tsx`.
7. `services/auth.services.ts`, then the `(authentication)` route group end to end.
8. `(dashboard)` shell (Sidebar with collapsible sections from `config/menu`, Topbar with search /
   notifications / avatar) + placeholder dashboard page.
9. `(marketing)` group: navbar, landing page, privacy, terms.
10. `middleware.ts`, `public/` icon set + `site.webmanifest`, README, `.env.example`.

## 9. Acceptance checklist

- [ ] `pnpm build` and `pnpm dev` both succeed with zero TS errors; no `any` added, no `debugger`/stray `console.log`.
- [ ] Only `services/base.ts` imports `axios`; only `services/*.services.ts` import `http`.
- [ ] All browser requests hit `/api/...`; swapping `NEXT_PUBLIC_BASE_URL` retargets the backend with no code change.
- [ ] Concurrent 401s produce exactly one refresh call, and every queued request replays with the new token.
- [ ] Network errors and non-JSON failures reject (never resolve `undefined`).
- [ ] Auth persists across reload; `hydrated` gates auth-dependent UI; logout clears store + storage.
- [ ] Zero raw hex in components — brand token classes only; light and dark both legible.
- [ ] Every auth route renders, validates, shows inline + toast errors, and has a loading state.
- [ ] No `tailwind.config.*`; no secrets committed; pm2 app name/port match `package.json`.
