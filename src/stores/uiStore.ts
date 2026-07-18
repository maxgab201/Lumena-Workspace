import { create } from 'zustand';

interface UiState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  // Theme
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;

  // Right panel (viewer)
  activeRightPanel: 'chat' | 'knowledge' | 'none';
  setActiveRightPanel: (panel: 'chat' | 'knowledge' | 'none') => void;

  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Dashboard preferences
  dashboardViewMode: 'grid' | 'list';
  setDashboardViewMode: (mode: 'grid' | 'list') => void;
  dashboardSortBy: 'name' | 'date' | 'size';
  setDashboardSortBy: (sort: 'name' | 'date' | 'size') => void;
  dashboardSortOrder: 'asc' | 'desc';
  setDashboardSortOrder: (order: 'asc' | 'desc') => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  // Theme
  theme: 'dark',
  setTheme: (theme) => {
    set({ theme });
    // Apply theme class to document
    const root = document.documentElement;
    root.classList.remove('light');
    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!prefersDark) root.classList.add('light');
    }
  },

  // Right panel
  activeRightPanel: 'none',
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

  // Command palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // Dashboard preferences
  dashboardViewMode: 'grid',
  setDashboardViewMode: (mode) => set({ dashboardViewMode: mode }),
  dashboardSortBy: 'date',
  setDashboardSortBy: (sort) => set({ dashboardSortBy: sort }),
  dashboardSortOrder: 'desc',
  setDashboardSortOrder: (order) => set({ dashboardSortOrder: order }),
}));
