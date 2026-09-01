import { LayoutDashboard, type LucideIcon } from 'lucide-react';

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
   * at all before its children are filtered individually).
   */
  permission?: string;
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
];

/**
 * Filters MENU down to what a staff session with the given permissions may
 * see. A section with no `permission` is always shown; a section that is a
 * group is shown if it has no `permission` (or the holder has it) AND at
 * least one child survives filtering. `permissions` being `null`/`undefined`
 * (no staff session resolved yet) is treated as "no permissions" so nothing
 * gated is shown prematurely.
 */
export function filterMenuByPermissions(
  menu: MenuSection[],
  permissions: readonly string[] | null | undefined,
): MenuSection[] {
  const held = permissions ?? [];
  const has = (permission?: string): boolean => !permission || held.includes(permission);

  return menu.reduce<MenuSection[]>((acc, section) => {
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
