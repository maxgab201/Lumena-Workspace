import { create } from 'zustand';
import { SettingsRepository } from '../repositories/settings.repository';
import { supabase } from '../lib/supabase';

interface UiStore {
  theme: 'light' | 'dark' | 'system';
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeRightPanel: 'chat' | 'activity' | 'knowledge' | 'none' | null;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setViewMode: (mode: 'grid' | 'list') => Promise<void>;
  setSortBy: (sort: 'date' | 'name' | 'size') => void;
  toggleSortOrder: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveRightPanel: (panel: 'chat' | 'activity' | 'knowledge' | 'none' | null) => void;
  loadSettings: () => Promise<void>;
}

export const useUiStore = create<UiStore>((set, get) => ({
  theme: 'system',
  viewMode: 'grid',
  sortBy: 'date',
  sortOrder: 'desc',
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  commandPaletteOpen: false,
  activeRightPanel: null,

  setTheme: async (theme) => {
    set({ theme });
    localStorage.setItem('theme', theme);

    // Apply theme changes to body/documentElement
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    // Persist to user settings table if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        await SettingsRepository.updateSettings({ theme });
      } catch (err) {
        console.error('Failed to sync theme to DB:', err);
      }
    }
  },

  setViewMode: async (viewMode) => {
    set({ viewMode });
    localStorage.setItem('viewMode', viewMode);
  },

  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  toggleSortOrder: () => {
    set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' }));
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

  loadSettings: async () => {
    // 1. Sync viewMode from localStorage
    const cachedViewMode = localStorage.getItem('viewMode') as 'grid' | 'list';
    if (cachedViewMode) {
      set({ viewMode: cachedViewMode });
    }

    // 2. Sync theme preference (DB takes priority over localStorage)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const settings = await SettingsRepository.getSettings();
        if (settings?.theme) {
          await get().setTheme(settings.theme as 'light' | 'dark' | 'system');
          return;
        }
      } catch (err) {
        console.error('Failed to load theme from DB:', err);
      }
    }

    const cachedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system';
    await get().setTheme(cachedTheme);
  },
}));
