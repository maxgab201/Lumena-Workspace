import { create } from 'zustand';
import { AuthRepository } from '../repositories/auth.repository';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserStore {
  user: User | null;
  profile: { name?: string | null; avatar_url?: string | null } | null;
  loading: boolean;
  error: string | null;
  initialize: () => () => void;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: () => {
    let isMounted = true;

    // Get initial session user - don't fail if this throws
    AuthRepository.getUser()
      .then(async (user) => {
        if (!isMounted) return;
        let profile = null;
        if (user) {
          const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single();
          profile = data;
        }
        set({ user, profile, loading: false });
      })
      .catch(() => {
        // Don't set loading=false here - let onAuthStateChange handle it
        if (!isMounted) return;
        // Silently ignore - onAuthStateChange will fire with the actual session
      });

    // Subscribe to auth state changes - this is the source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      let profile = null;
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', session.user.id).single();
        profile = data;
      }
      set({ user: session?.user ?? null, profile, loading: false });
    });

    // Cleanup function
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await AuthRepository.signOut();
      set({ user: null, profile: null, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));