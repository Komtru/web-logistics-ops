'use client';

import { Bell, ChevronDown, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OperatorAvatar } from '@/components/general/operator-avatar';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { operatorLabel } from '@/helpers/session';
import { useAuthStore } from '@/store/auth.store';

interface TopbarProps {
  /** Unread operational alerts. Modules supply this once they exist. */
  alertCount?: number;
}

export function Topbar({ alertCount = 0 }: TopbarProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const user = useAuthStore((state) => state.user);
  const auth = useAuthStore((state) => state.auth);
  const profile = useAuthStore((state) => state.profile);
  const hydrated = useAuthStore((state) => state.hydrated);

  // Display-name, else username, else email — with the public id underneath,
  // which is what an operator would actually read out on a call.
  const label = operatorLabel(user, auth, profile);

  return (
    <header className="bg-background/55 border-border/70 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 !h-5" />

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              <Sun className="size-4 dark:hidden" aria-hidden />
              <Moon className="hidden size-4 dark:block" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative" aria-label="Alerts">
              <Bell className="size-4" aria-hidden />
              {alertCount > 0 ? (
                <span className="bg-komtru-risk absolute top-1 right-1 size-1.5 rounded-full" />
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {alertCount > 0 ? `${alertCount} need attention` : 'Nothing needs attention'}
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 !h-5" />

        {/* Gated on `hydrated`: reading persisted state during SSR would
            mismatch, and the menu has nothing to act on until the session is
            known — so the trigger stays inert rather than offering a sign-out
            that would fire with no token. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!hydrated}>
            <button
              type="button"
              className="hover:bg-accent/60 focus-visible:ring-ring flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
              aria-label="Account menu"
            >
              <OperatorAvatar
                label={hydrated ? label : null}
                avatarUrl={hydrated ? profile?.avatarUrl : null}
              />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[12.5px] font-semibold">
                  {hydrated && label ? label : 'Signed out'}
                </span>
                <span className="text-muted-foreground trade-code block text-[11px]">
                  {hydrated && user ? user.publicId : '—'}
                </span>
              </span>
              <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-2">
              <OperatorAvatar label={label} avatarUrl={profile?.avatarUrl} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold">
                  {label ?? 'Signed out'}
                </span>
                {/* The public id, not the email: `label` is already the email
                    whenever the account has no username, and repeating it would
                    say nothing. */}
                <span className="text-muted-foreground trade-code block truncate text-[11px] font-normal">
                  {user?.publicId ?? '—'}
                </span>
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings aria-hidden />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* A link, not a handler: sign-out is a sequence with a required
                order that has to survive a failed API call, so it lives on its
                own page. */}
            <DropdownMenuItem asChild variant="destructive">
              <Link href="/logout">
                <LogOut aria-hidden />
                Sign out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
