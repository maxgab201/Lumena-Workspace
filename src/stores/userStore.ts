import { create } from 'zustand';
import type { User, Credits } from '../types';
import { authService } from '../services/auth.service';
import { useWorkspaceStore } from './workspaceStore';

interface UserState {
  user: User | null;
  credits: Credits | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => void;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  credits: null, // Will be fetched later from DB
  isAuthenticated: false,
  isLoading: true,
  initialize: () => {
    const handleAuthChange = (session: any) => {
      if (session?.user) {
        set({ 
          user: { 
            id: session.user.id, 
            email: session.user.email!, 
            name: session.user.user_metadata?.full_name || 'User',
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at 
          }, 
          isAuthenticated: true, 
          isLoading: false 
        });
        // Trigger fetch of workspaces
        useWorkspaceStore.getState().fetchWorkspaces();
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
        useWorkspaceStore.getState().workspaces = [];
        useWorkspaceStore.getState().activeWorkspaceId = null;
      }
    };

    // Initial fetch
    authService.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    // Listen for changes
    authService.onAuthStateChange((session) => {
      handleAuthChange(session);
    });
  },
  logout: async () => {
    await authService.signOut();
  },
}));

