
-- Add avatar customization + badge columns to existing profiles table
alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_seed text,
  add column if not exists avatar_hair text,
  add column if not exists avatar_hair_color text,
  add column if not exists avatar_skin_color text,
  add column if not exists avatar_facial_hair text,
  add column if not exists avatar_accessories text,
  add column if not exists avatar_clothing text,
  add column if not exists avatar_clothing_color text,
  add column if not exists avatar_eye_type text,
  add column if not exists avatar_eyebrow_type text,
  add column if not exists avatar_mouth_type text,
  add column if not exists earned_badges text[] not null default '{}';

-- Backfill avatar_seed for existing rows that don't have one
update public.profiles set avatar_seed = id::text where avatar_seed is null;

-- Badges reference table (admin-managed, publicly readable)
create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  color text not null
);
alter table public.badges enable row level security;
create policy "badges public read" on public.badges for select using (true);

-- Seed the six launch badges
insert into public.badges (id, name, description, icon, color) values
  ('first_scout',     'First Scout',     'Completed your first search',        '🔍', 'purple'),
  ('capital_curious', 'Capital Curious',  'Explored the funding tracker',       '💰', 'green'),
  ('job_hunter',      'Job Hunter',       'Applied to your first role',         '💼', 'blue'),
  ('navigator',       'Navigator',        'Completed the resource quiz',        '🧭', 'orange'),
  ('connected',       'Connected',        'Viewed a company profile',           '🤝', 'teal'),
  ('early_adopter',   'Early Adopter',    'Joined during the hackathon launch', '🚀', 'coral')
on conflict (id) do nothing;

-- Update handle_new_user to set avatar_seed and award early_adopter on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_seed, earned_badges)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.id::text,
    array['early_adopter']
  )
  on conflict (id) do update
    set
      avatar_seed   = coalesce(profiles.avatar_seed, new.id::text),
      earned_badges = case
        when 'early_adopter' = any(profiles.earned_badges) then profiles.earned_badges
        else profiles.earned_badges || array['early_adopter']
      end;

  insert into public.user_roles (user_id, role)
  values (new.id, 'founder')
  on conflict do nothing;

  return new;
end;
$$;
