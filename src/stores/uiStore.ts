import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  activeRightPanel: 'chat' | 'knowledge' | 'none';
  setActiveRightPanel: (panel: 'chat' | 'knowledge' | 'none') => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  activeRightPanel: 'none',
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),
}));
