import { Construction, type LucideIcon } from 'lucide-react';

interface ModulePlaceholderProps {
  /** Matches the sidebar label for this module. */
  title: string;
  /** What the module will do once built — one or two lines. */
  description: string;
  /** The module's sidebar icon, so the page and the nav entry agree. */
  icon: LucideIcon;
}

/**
 * Stands in for a module that has a route and a sidebar entry but no screens
 * yet, so operators land on something deliberate instead of a 404.
 *
 * Every module gets its real page in its own change, at which point this import
 * goes away. Nothing here fetches or invents field names: the API contracts are
 * still open, and a mock table would only have to be unpicked later.
 */
export function ModulePlaceholder({ title, description, icon: Icon }: ModulePlaceholderProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Icon className="text-muted-foreground size-[18px]" aria-hidden />
          {title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-[12.5px] leading-relaxed">
          {description}
        </p>
      </div>

      {/* Same dashed-panel treatment as `QueryState`'s empty branch, so a
          not-built module reads like the rest of the console rather than a gap. */}
      <div className="border-border flex min-h-60 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
        <Construction className="text-muted-foreground size-5" aria-hidden />
        <p className="text-sm font-semibold">Not built yet</p>
        <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
          This module has a route and a place in the sidebar. The screens arrive with its own
          release.
        </p>
      </div>
    </div>
  );
}
