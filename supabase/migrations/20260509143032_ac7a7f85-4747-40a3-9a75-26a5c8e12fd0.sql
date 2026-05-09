create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text,
  source text not null,
  source_id text,
  start_date timestamptz,
  end_date timestamptz,
  location_name text,
  is_online boolean not null default false,
  image_url text,
  organizer text,
  industries text[] not null default '{}',
  stages text[] not null default '{}',
  topics text[] not null default '{}',
  is_active boolean not null default true,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(source, source_id)
);

alter table public.events enable row level security;

drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select using (is_active = true or public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins manage events" on public.events;
create policy "admins manage events" on public.events
  for all using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));