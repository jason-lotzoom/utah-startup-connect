
-- Enums
create type public.app_role as enum ('admin', 'founder', 'investor');

-- user_roles table (separate from profiles to prevent privilege escalation)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users see own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins see all roles" on public.user_roles for select using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  company_id uuid,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles public read" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "admins manage profiles" on public.profiles for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- handle new user trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'founder')
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- resources
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  description text,
  communities text[] default '{}',
  industries text[] default '{}',
  locations text[] default '{}',
  topics text[] default '{}',
  link text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.resources enable row level security;
create policy "resources public read" on public.resources for select using (is_active = true or public.has_role(auth.uid(),'admin'));
create policy "admins manage resources" on public.resources for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  website text,
  linkedin_url text,
  full_address text,
  latitude double precision,
  longitude double precision,
  sector text,
  stage text,
  employee_count text,
  year_founded int,
  hiring_status boolean not null default false,
  logo_url text,
  photos text[] default '{}',
  is_verified boolean not null default false,
  is_claimed boolean not null default false,
  claimed_by uuid references auth.users(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;
create policy "companies public read active" on public.companies for select using (status = 'active' or public.has_role(auth.uid(),'admin') or auth.uid() = claimed_by or auth.uid() = submitted_by);
create policy "anyone can submit company" on public.companies for insert with check (true);
create policy "owners update their company" on public.companies for update using (auth.uid() = claimed_by or auth.uid() = submitted_by) with check (auth.uid() = claimed_by or auth.uid() = submitted_by);
create policy "admins manage companies" on public.companies for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- job postings
create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  location text,
  type text,
  url text,
  is_active boolean not null default true,
  ai_imported boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.job_postings enable row level security;
create policy "jobs public read" on public.job_postings for select using (is_active = true);
create policy "company owners manage jobs" on public.job_postings for all
  using (exists (select 1 from public.companies c where c.id = company_id and (auth.uid() = c.claimed_by or auth.uid() = c.submitted_by)))
  with check (exists (select 1 from public.companies c where c.id = company_id and (auth.uid() = c.claimed_by or auth.uid() = c.submitted_by)));
create policy "admins manage jobs" on public.job_postings for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- claim requests
create table public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.claim_requests enable row level security;
create policy "users see own claim requests" on public.claim_requests for select using (auth.uid() = user_id);
create policy "admins see all claim requests" on public.claim_requests for select using (public.has_role(auth.uid(),'admin'));
create policy "users insert own claim requests" on public.claim_requests for insert with check (auth.uid() = user_id);
create policy "admins manage claim requests" on public.claim_requests for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- navigator sessions
create table public.navigator_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_data jsonb,
  recommendations jsonb,
  created_at timestamptz not null default now()
);
alter table public.navigator_sessions enable row level security;
create policy "anyone insert navigator sessions" on public.navigator_sessions for insert with check (true);
create policy "users see own sessions" on public.navigator_sessions for select using (auth.uid() = user_id or user_id is null);
create policy "admins see all sessions" on public.navigator_sessions for select using (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_resources before update on public.resources for each row execute function public.touch_updated_at();
create trigger touch_companies before update on public.companies for each row execute function public.touch_updated_at();
