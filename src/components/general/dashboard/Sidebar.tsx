'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { KomtruMark } from '@/components/general/komtru-mark';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { filterMenuByPermissions, MENU, type MenuItem } from '@/config/menu';
import { useAuthStore } from '@/store/auth.store';
import { useSidebarStore } from '@/store/sidebar.store';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  /**
   * Counts surfaced next to nav items, keyed by a menu item's `badgeKey`.
   * Modules supply these as they land.
   */
  badges?: Record<string, number | undefined>;
}

/**
 * Matches on pathname, and on `?status=` when a menu entry points at a filtered
 * view of the same page, so sibling filter links don't all highlight at once.
 */
function useIsActive() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status');

  return function isActive(href: string) {
    const [path, query] = href.split('?');
    if (pathname !== path) return false;

    const hrefStatus = query ? new URLSearchParams(query).get('status') : null;
    return hrefStatus === currentStatus;
  };
}

export function AppSidebar({ badges }: AppSidebarProps) {
  const isActive = useIsActive();
  const { openSections, toggleSection } = useSidebarStore();
  const staffPermissions = useAuthStore((state) => state.staff?.permissions);
  const isLogisticsSession = useAuthStore((state) => Boolean(state.logistics));
  const logistics = useAuthStore((state) => state.logistics);
  const scope: 'STAFF' | 'LOGISTICS' = isLogisticsSession ? 'LOGISTICS' : 'STAFF';
  const menu = useMemo(
    () => filterMenuByPermissions(MENU, staffPermissions, scope),
    [staffPermissions, scope],
  );

  // The inner pane is transparent so the shell wash shows through; the only
  // edge is a hairline in `--sidebar-border`. The mobile sheet keeps its own
  // solid fill (that branch ignores `className`) since it floats over content.
  return (
    <Sidebar
      collapsible="icon"
      className="border-r-sidebar-border **:data-[slot=sidebar-inner]:bg-transparent"
    >
      <SidebarHeader className="border-sidebar-border border-b px-4 py-4">
        <Link href="/dashboard" className="font-display flex items-center gap-2 font-semibold">
          <KomtruMark className="text-komtru-cyan" size={20} />
          <span className="group-data-[collapsible=icon]:hidden">Komtru</span>
        </Link>
        {isLogisticsSession && logistics && (
          <div className="mt-2 space-y-0.5">
            <p className="text-sidebar-foreground/70 text-[10.5px] font-medium">
              Logistics Company
            </p>
            <p className="text-sidebar-foreground text-[12px] font-semibold">
              {logistics.companyName}
            </p>
            <p className="text-sidebar-foreground/55 text-[10px] capitalize">
              {logistics.role}
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Control room</SidebarGroupLabel>
          <SidebarMenu>
            {menu.map((section) => {
              if (!section.items?.length) {
                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={section.href ? isActive(section.href) : false}
                      tooltip={section.label}
                    >
                      <Link href={section.href ?? '#'}>
                        <section.icon aria-hidden />
                        <span>{section.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }

              const isOpen = openSections.includes(section.id);

              return (
                <Collapsible
                  key={section.id}
                  open={isOpen}
                  onOpenChange={() => toggleSection(section.id)}
                  className="group/collapsible"
                  asChild
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={section.label}>
                        <section.icon aria-hidden />
                        <span>{section.label}</span>
                        <ChevronRight
                          className={cn(
                            'ml-auto transition-transform duration-200',
                            isOpen && 'rotate-90',
                          )}
                          aria-hidden
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item: MenuItem) => {
                          const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;

                          return (
                            <SidebarMenuSubItem key={item.id}>
                              <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                                <Link href={item.href}>
                                  <span>{item.label}</span>
                                  {badge ? (
                                    <span className="bg-komtru-gold/20 text-komtru-gold-soft ml-auto rounded-full px-1.5 text-[10px] font-semibold">
                                      {badge}
                                    </span>
                                  ) : null}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t px-4 py-3">
        <p className="text-sidebar-foreground/55 text-[10.5px] leading-relaxed group-data-[collapsible=icon]:hidden">
          Internal operations console.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
