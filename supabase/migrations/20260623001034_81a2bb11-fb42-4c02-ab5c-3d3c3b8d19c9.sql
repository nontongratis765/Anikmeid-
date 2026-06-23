
-- Owner & user #4 premium unlimited
UPDATE public.profiles
SET premium_until = '9999-12-31T00:00:00Z'::timestamptz
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'owner')
   OR user_number = 4;

-- Rename users impersonating developer "lordbye"
UPDATE public.profiles
SET display_name = 'Unknown'
WHERE LOWER(display_name) LIKE '%lordbye%'
  AND id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'owner');

-- App settings table (singleton row id=1) for premium fundraising progress
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  premium_goal INTEGER NOT NULL DEFAULT 100000,
  premium_progress INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read settings" ON public.app_settings;
CREATE POLICY "anyone read settings" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "owner write settings" ON public.app_settings;
CREATE POLICY "owner write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));
INSERT INTO public.app_settings(id) VALUES (1) ON CONFLICT DO NOTHING;
