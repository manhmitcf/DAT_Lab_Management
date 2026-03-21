import { create } from 'zustand';

interface SidebarState {
    isCollapsed: boolean;
    isMobileOpen: boolean;
    toggleSidebar: () => void;
    setCollapsed: (collapsed: boolean) => void;
    toggleMobileOpen: () => void;
    setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
    isCollapsed: false,
    isMobileOpen: false,
    toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
    setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
    toggleMobileOpen: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
    setMobileOpen: (open) => set({ isMobileOpen: open }),
}));
