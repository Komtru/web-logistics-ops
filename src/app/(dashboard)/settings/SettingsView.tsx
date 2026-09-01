'use client';

import { Laptop, LogOut, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

import { EditProfileCard } from '@/app/(dashboard)/settings/EditProfileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { operatorLabel } from '@/helpers/session';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

const THEMES = [
  { value: 'system', label: 'System', icon: Laptop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

/** One read-only fact about the session. */
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border/60 flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
      <dt className="text-muted-foreground text-[12px]">{label}</dt>
      <dd className={cn('truncate text-[12.5px] font-medium', mono && 'trade-code')}>{value}</dd>
    </div>
  );
}

/**
 * Operator settings.
 *
 * Three kinds of thing, and the distinction is what the copy on each card is for:
 *
 * - **Appearance** — local to this browser, never sent anywhere.
 * - **Your profile** — the operator's own editable record, over `admin/me`. It was read-only until that
 *   endpoint existed: `GET me/` is CONSUMER-scoped and 403s a staff token, and `admin/staff/:id`
 *   refuses self-dealing, so nothing an operator could call would return their own profile.
 * - **Account** and **Sessions** — facts the console cannot change from here. The account fields come
 *   from the session store, refreshed on every page load by `useSessionSync`, so they are as current as
 *   the last load rather than as the last sign-in.
 */
export function SettingsView() {
  const { theme, setTheme } = useTheme();

  const user = useAuthStore((state) => state.user);
  const auth = useAuthStore((state) => state.auth);
  const profile = useAuthStore((state) => state.profile);
  const hydrated = useAuthStore((state) => state.hydrated);

  const label = operatorLabel(user, auth, profile);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          Preferences for this browser, and what the console knows about your session.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13.5px]">Appearance</CardTitle>
          <CardDescription className="text-[12px]">
            Stored in this browser only — it follows the device, not the account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* `theme` is undefined until next-themes reads the stored preference,
              so the selected state can't be rendered on the server. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
            {THEMES.map((option) => {
              const selected = theme === option.value;

              return (
                <Button
                  key={option.value}
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={selected}
                >
                  <option.icon className="size-3.5" aria-hidden />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Above the read-only facts, because it is the only card on this page an operator came here to
          act on. Gated on `hydrated` for the same reason the card below is: it seeds its field from
          persisted state, which does not exist during SSR. */}
      {hydrated ? <EditProfileCard /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-[13.5px]">Account</CardTitle>
          <CardDescription className="text-[12px]">
            Read-only. Your role, status and identifiers are changed by an administrator — refreshed
            here on every page load.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hydrated ? (
            <dl>
              <Row label="Signed in as" value={label ?? '—'} />
              <Row label="Email" value={auth?.email ?? '—'} />
              <Row label="Username" value={user?.username ?? 'Not set'} />
              <Row label="Public ID" value={user?.publicId ?? '—'} mono />
              <Row label="User ID" value={user?.userId ?? '—'} mono />
              <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2.5 last:border-b-0">
                <dt className="text-muted-foreground text-[12px]">Status</dt>
                <dd className="flex items-center gap-1.5">
                  <Badge variant={user?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {user?.status ?? 'Unknown'}
                  </Badge>
                  <Badge variant="outline">{user?.verificationLevel ?? 'Unknown'}</Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-[12.5px]">Restoring session…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13.5px]">Sessions</CardTitle>
          <CardDescription className="text-[12px]">
            Signing out revokes the session server-side and clears it from this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {/* Both are links into the logout page, which owns the ordering:
              revoke, then tear down local state, then leave. */}
          <Button variant="outline" size="sm" asChild>
            <Link href="/logout">
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/logout?scope=all">
              <LogOut className="size-3.5" aria-hidden />
              Sign out everywhere
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
