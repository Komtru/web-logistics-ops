import { create } from 'zustand';

interface ISidebarStore {
  collapsed: boolean;
  openSections: string[];
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleSection: (id: string) => void;
}

/** Tiny, deliberately non-persisted UI state. */
export const useSidebarStore = create<ISidebarStore>((set) => ({
  collapsed: false,
  /** Ids of expanded collapsible nav sections; modules add their own. */
  openSections: [],

  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),

  setCollapsed: (collapsed) => set({ collapsed }),

  toggleSection: (id) =>
    set((state) => ({
      openSections: state.openSections.includes(id)
        ? state.openSections.filter((section) => section !== id)
        : [...state.openSections, id],
    })),
}));
