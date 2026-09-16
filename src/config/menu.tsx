import { LayoutDashboard, Package, Users, type LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  /** Rendered as a count/attention pill when the value resolves. */
  badgeKey?: string;
  /**
   * Permission code required to see this entry. Omit for entries every
   * operator with any staff session can see.
   */
  permission?: string;
}

export interface MenuSection {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Leaf entry. Mutually exclusive with `items`. */
  href?: string;
  /** Collapsible group. */
  items?: MenuItem[];
  /**
   * Permission code required to see this entry (or, for a group, to see it
   * at all before its children are filtered individually). STAFF-only —
   * a Logistics session has no `staff.permissions` to check against, so an
   * entry gated by `permission` is implicitly Staff-only regardless of
   * `scope`.
   */
  permission?: string;
  /**
   * Which session scope may see this entry. Omit for entries visible to
   * every authenticated session, Staff or Logistics alike (e.g. the
   * dashboard). `'LOGISTICS'` entries ignore `permission` — that kind of
   * fine-grained gating is Staff's RBAC model; a Logistics POC's ADMIN vs
   * OPERATOR split is a separate, screen-level check (see the Team screen).
   */
  scope?: 'STAFF' | 'LOGISTICS';
}

/**
 * Operator navigation.
 *
 * Module sections get added here as they are built, either as a leaf
 * (`href`) or as a collapsible group (`items`); the sidebar renders both
 * shapes already.
 *
 * Access rules: entries and items may declare a `permission` code, checked
 * against the current staff session's permission list (see
 * `filterMenuByPermissions` below). An entry with no `permission` is shown
 * to every staff session. Filtering happens once at the layout boundary
 * (`DashboardShell`/`Sidebar`), not scattered through individual pages.
 */
export const MENU: MenuSection[] = [
  {
    id: 'overview',
    label: 'Command center',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    href: '/team',
    scope: 'LOGISTICS',
  },
  {
    id: 'packages',
    label: 'Packages',
    icon: Package,
    href: '/packages',
    scope: 'LOGISTICS',
  },
];

/**
 * Filters MENU down to what a session may see, given its `scope` and (for
 * STAFF) its held permissions.
 *
 * A section is shown if:
 * - its `scope` (if any) matches the current session's scope, AND
 * - it has no `permission`, or the holder has it (STAFF permission checks
 *   only — a LOGISTICS session always passes this half, since `permission`
 *   is Staff's RBAC model and irrelevant to it),
 *
 * and, for a group, at least one child survives the same two checks.
 *
 * `permissions` being `null`/`undefined` (no staff session resolved yet) is
 * treated as "no permissions" so nothing gated is shown prematurely.
 * `scope` defaults to `'STAFF'` so every existing call site (all of which
 * predate Logistics sessions) keeps its current behaviour unchanged.
 */
export function filterMenuByPermissions(
  menu: MenuSection[],
  permissions: readonly string[] | null | undefined,
  scope: 'STAFF' | 'LOGISTICS' = 'STAFF',
): MenuSection[] {
  const held = permissions ?? [];
  const has = (permission?: string): boolean => !permission || held.includes(permission);
  const inScope = (entryScope?: 'STAFF' | 'LOGISTICS'): boolean =>
    !entryScope || entryScope === scope;

  return menu.reduce<MenuSection[]>((acc, section) => {
    if (!inScope(section.scope)) return acc;
    if (!has(section.permission)) return acc;

    if (section.items) {
      const items = section.items.filter((item) => has(item.permission));
      if (items.length === 0) return acc;
      acc.push({ ...section, items });
      return acc;
    }

    acc.push(section);
    return acc;
  }, []);
}
