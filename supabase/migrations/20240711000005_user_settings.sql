-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',
  dashboard_view_mode TEXT NOT NULL DEFAULT 'grid',
  dashboard_sort_by TEXT NOT NULL DEFAULT 'date',
  dashboard_sort_order TEXT NOT NULL DEFAULT 'desc',
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING ( auth.uid() = id );

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING ( auth.uid() = id );

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK ( auth.uid() = id );

-- Trigger to create default settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_settings();

-- Backfill settings for existing profiles
INSERT INTO public.user_settings (id)
SELECT id FROM public.profiles
ON CONFLICT (id) DO NOTHING;
