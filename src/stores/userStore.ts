import { create } from 'zustand';
import { AuthRepository } from '../repositories/auth.repository';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UserStore {
  user: User | null;
  profile: { name?: string | null; avatar_url?: string | null } | null;
  loading: boolean;
  error: string | null;
  initialize: () => void;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: () => {
    // Get initial session user
    AuthRepository.getUser()
      .then(async (user) => {
        let profile = null;
        if (user) {
          const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single();
          profile = data;
        }
        set({ user, profile, loading: false });
      })
      .catch((err) => {
        set({ user: null, profile: null, error: err.message, loading: false });
      });

    // Subscribe to auth state changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      let profile = null;
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', session.user.id).single();
        profile = data;
      }
      set({ user: session?.user ?? null, profile, loading: false });
    });
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
