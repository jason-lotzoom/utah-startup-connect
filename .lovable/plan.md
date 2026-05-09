Four features to add. The `job_postings` table and `resources` table already exist with the right shape (213 resources, 151 tagged "Funding"; jobs table is empty until the Firecrawl scan is triggered).

## 1. Working "Match Me" global search (home hero)

Today the hero input does nothing visible. Wire it to a real search.

- On submit, route to `/navigator?q=<query>` (the Navigator already accepts search params; we'll have it pre-fill and skip to the results step when a free-text query is present).
- Add a lightweight client-side **search across companies + resources + jobs** (Supabase `or(name.ilike.%q%,description.ilike.%q%)` + same for resources/title and jobs/title) that runs on `?q=`.
- Render results in three grouped sections: Companies, Programs & Capital, Open roles.
- **Empty state**: friendly card with the searched term, three suggested example queries (the existing chips), and CTAs to "Browse the map", "Take the Navigator quiz", and "Submit a company".

## 2. Job postings table — already exists, harden RLS + add admin UI

`public.job_postings` is already created with public-read (`is_active = true`), company-owner manage, and admin manage policies — that satisfies the "admin-only create/edit + public read" requirement. We'll:

- Add a **migration** for one missing piece: a `posted_at TIMESTAMPTZ` column with default `now()` so the job board can sort/filter by recency, plus an index on `(is_active, posted_at desc)`.
- Add a tiny **admin section** in `/admin` to manually create/edit/deactivate a job posting (form: company picker, title, location, type, url, description) for jobs not picked up by Firecrawl.

## 3. `/capital` — Funding & Capital tracker

New route `src/routes/capital.tsx` reading from `public.resources` filtered to `topics @> '{Funding}'` (151 rows ready).

- Hero with count of active capital sources + last updated.
- Filters (chip rows): **Stage** (Idea / Pre-seed / Seed / Series A+ — derived from title/description heuristics or a new `stages text[]` column we add), **Sector** (from `industries` array), **Community** (from `communities` array — Rural, Veteran, Women, etc.).
- Card grid: title, description, community/industry badges, "Apply / Learn more" external link.
- Search box (title + description ilike).
- Sort: alphabetical / newest.

Migration: add nullable `stages text[]` to `resources` (default `{}`) so capital entries can be tagged by stage. Existing rows keep working.

## 4. `/jobs` — Public job board

New route `src/routes/jobs.tsx` reading `public.job_postings` joined with `companies` (for employer name, sector, location, logo).

- Hero showing total open roles + sectors hiring + last refresh time (reuses `hiring_refresh_runs`).
- Filters: **Industry** (company.sector), **Location** (city extracted from job.location or company.full_address), **Type** (full-time/contract/internship), **Hiring company** search.
- Job cards: title, company name + logo, location, type chip, posted-at relative, "Apply" CTA (external `url`).
- Empty state when scan hasn't run: "No live roles yet — the next Firecrawl scan will populate this. [Trigger scan] (admin only)" + link to `/map?hiring=true`.
- Add nav links to `/jobs` and `/capital` in `SiteNav` desktop + mobile, and in the footer Platform column.

## Order of work

1. Migration: add `posted_at` to `job_postings`, add `stages` to `resources`.
2. `/capital` page (data already exists, fastest visible win).
3. `/jobs` page + nav links.
4. Hero "Match Me" wiring + global search results section + empty state.
5. Admin job-posting form in `/admin`.

## Out of scope (to keep this shippable)

- Saved searches, email alerts, RSS — defer.
- Stage extraction from resource descriptions via AI — start with manual tagging via the admin UI on `resources`, add AI back-fill later.
- Dedicated employer profiles — link to existing `/map/company/$id` page instead.
