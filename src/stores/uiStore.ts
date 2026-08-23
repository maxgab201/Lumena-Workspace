import { create } from 'zustand';
import { SettingsRepository } from '../repositories/settings.repository';
import { supabase } from '../lib/supabase';
import { getLanguage, setLanguage, type Language } from '../i18n';

interface UiStore {
  theme: 'light' | 'dark' | 'system';
  lang: Language;
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeRightPanel: 'chat' | 'activity' | 'knowledge' | 'none' | null;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  setLang: (lang: Language) => Promise<void>;
  setViewMode: (mode: 'grid' | 'list') => Promise<void>;
  setSortBy: (sort: 'date' | 'name' | 'size') => Promise<void>;
  toggleSortOrder: () => Promise<void>;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveRightPanel: (panel: 'chat' | 'activity' | 'knowledge' | 'none' | null) => void;
  loadSettings: () => Promise<void>;
}

async function persistSettingsIfAuthenticated(
  updates: Record<string, unknown>,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  try {
    await SettingsRepository.updateSettings(updates as any);
  } catch (err) {
    // Non-fatal: local state already updated. Log and continue.
    console.error('[UiStore] Failed to sync settings to DB:', err);
  }
}

export const useUiStore = create<UiStore>((set, get) => ({
  theme: 'system',
  lang: getLanguage(),
  viewMode: 'grid',
  sortBy: 'date',
  sortOrder: 'desc',
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  commandPaletteOpen: false,
  activeRightPanel: null,

  setTheme: async (theme) => {
    set({ theme });

    // Apply theme to DOM
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    await persistSettingsIfAuthenticated({ theme });
  },

  setLang: async (lang) => {
    setLanguage(lang);
    set({ lang });
    await persistSettingsIfAuthenticated({ lang });
  },

  setViewMode: async (viewMode) => {
    set({ viewMode });
    await persistSettingsIfAuthenticated({ view_mode: viewMode });
  },

  setSortBy: async (sortBy) => {
    set({ sortBy });
    await persistSettingsIfAuthenticated({ sort_by: sortBy });
  },

  toggleSortOrder: async () => {
    const newOrder = get().sortOrder === 'asc' ? 'desc' : 'asc';
    set({ sortOrder: newOrder });
    await persistSettingsIfAuthenticated({ sort_order: newOrder });
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

  loadSettings: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const settings = await SettingsRepository.getSettings();
        if (settings) {
          const theme = (settings.theme as 'light' | 'dark' | 'system') ?? 'system';
          const viewMode = (settings.view_mode as 'grid' | 'list') ?? 'grid';
          const sortBy = (settings.sort_by as 'date' | 'name' | 'size') ?? 'date';
          const sortOrder = (settings.sort_order as 'asc' | 'desc') ?? 'desc';

          // Apply theme to DOM
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
            root.classList.add(systemTheme);
          } else {
            root.classList.add(theme);
          }

          set({ theme, viewMode, sortBy, sortOrder });
          return;
        }
      } catch (err) {
        console.error('[UiStore] Failed to load settings from DB:', err);
      }
    }

    // Fallback: localStorage
    const cachedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') ?? 'system';
    await get().setTheme(cachedTheme);
  },
}));
