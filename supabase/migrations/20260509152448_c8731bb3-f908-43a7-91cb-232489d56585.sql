
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_seed text,
  ADD COLUMN IF NOT EXISTS avatar_hair text,
  ADD COLUMN IF NOT EXISTS avatar_hair_color text,
  ADD COLUMN IF NOT EXISTS avatar_skin_color text,
  ADD COLUMN IF NOT EXISTS avatar_facial_hair text,
  ADD COLUMN IF NOT EXISTS avatar_accessories text,
  ADD COLUMN IF NOT EXISTS avatar_clothing text,
  ADD COLUMN IF NOT EXISTS avatar_clothing_color text,
  ADD COLUMN IF NOT EXISTS avatar_eye_type text,
  ADD COLUMN IF NOT EXISTS avatar_eyebrow_type text,
  ADD COLUMN IF NOT EXISTS avatar_mouth_type text,
  ADD COLUMN IF NOT EXISTS earned_badges text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏅',
  color text NOT NULL DEFAULT 'purple',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges public read"
  ON public.badges FOR SELECT
  USING (true);

CREATE POLICY "admins manage badges"
  ON public.badges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
