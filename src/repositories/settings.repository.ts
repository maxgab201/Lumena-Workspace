import { supabase } from '../lib/supabase';

export const SettingsRepository = {
  async getSettings() {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateSettings(settings: {
    theme?: string;
    view_mode?: string;
    sort_by?: string;
    sort_order?: string;
    sidebar_collapsed?: boolean;
    // Legacy column names (keep for backward compat until migration is applied)
    dashboard_view_mode?: string;
    dashboard_sort_by?: string;
    dashboard_sort_order?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
