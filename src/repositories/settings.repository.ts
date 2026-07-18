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
    dashboard_view_mode?: string;
    dashboard_sort_by?: string;
    dashboard_sort_order?: string;
    sidebar_collapsed?: boolean;
  }) {
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ 
        id: (await supabase.auth.getUser()).data.user?.id || '',
        ...settings, 
        updated_at: new Date().toISOString() 
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
