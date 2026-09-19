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
  updateProfile: (name: string, email: string) => Promise<{ emailConfirmationRequired: boolean }>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
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

  updateProfile: async (name, email) => {
    const currentUser = get().user;
    if (!currentUser) throw new Error('Not authenticated');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) throw new Error('Name is required');
    if (!trimmedEmail) throw new Error('Email is required');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: trimmedName })
      .eq('id', currentUser.id);
    if (profileError) throw profileError;

    let nextUser = currentUser;
    let emailConfirmationRequired = false;
    if (trimmedEmail.toLowerCase() !== (currentUser.email ?? '').toLowerCase()) {
      const authData = await AuthRepository.updateUser({ email: trimmedEmail });
      if (authData.user) nextUser = authData.user;
      emailConfirmationRequired = authData.user?.email?.toLowerCase() !== trimmedEmail.toLowerCase();
    }

    set((state) => ({
      user: nextUser,
      profile: { ...(state.profile ?? {}), name: trimmedName },
      error: null,
    }));

    return { emailConfirmationRequired };
  },

  uploadAvatar: async (file) => {
    const currentUser = get().user;
    if (!currentUser) throw new Error('Not authenticated');
    if (file.size > 2 * 1024 * 1024) throw new Error('Avatar must be 2 MB or smaller');

    const allowed = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
    if (!allowed.has(file.type)) throw new Error('Use a PNG, JPG, GIF or WEBP image');

    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `${currentUser.id}/avatar.${ext}`;

    const existing = await supabase.storage.from('profile_avatars').list(currentUser.id);
    if (!existing.error && existing.data.length > 0) {
      const paths = existing.data.map((item) => `${currentUser.id}/${item.name}`);
      await supabase.storage.from('profile_avatars').remove(paths);
    }

    const { error: uploadError } = await supabase.storage
      .from('profile_avatars')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('profile_avatars').getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', currentUser.id);
    if (profileError) {
      await supabase.storage.from('profile_avatars').remove([path]);
      throw profileError;
    }

    set((state) => ({
      profile: { ...(state.profile ?? {}), avatar_url: avatarUrl },
      error: null,
    }));
  },

  removeAvatar: async () => {
    const currentUser = get().user;
    if (!currentUser) throw new Error('Not authenticated');

    const existing = await supabase.storage.from('profile_avatars').list(currentUser.id);
    if (!existing.error && existing.data.length > 0) {
      const paths = existing.data.map((item) => `${currentUser.id}/${item.name}`);
      const { error: removeError } = await supabase.storage.from('profile_avatars').remove(paths);
      if (removeError) throw removeError;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', currentUser.id);
    if (profileError) throw profileError;

    set((state) => ({
      profile: { ...(state.profile ?? {}), avatar_url: null },
      error: null,
    }));
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