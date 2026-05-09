
# Live hiring data on the Utah Startup Map

Four pieces, built in order so each one is verifiable on its own.

## 1. Connect Firecrawl

- Link the Firecrawl connector to this project (`standard_connectors--connect` with `connector_id: firecrawl`). This injects `FIRECRAWL_API_KEY` into the server runtime.
- Verify with `fetch_secrets` that `FIRECRAWL_API_KEY` is present.
- Quick sanity call from the sandbox to Firecrawl's `/v2/map` on a known URL (e.g. one of the company websites) to confirm the key works before wiring it into the edge function.

## 2. Edge function: `refresh-hiring`

New Supabase Edge Function at `supabase/functions/refresh-hiring/index.ts`, server-only, uses the service-role client.

What it does, per run:
1. `select id, name, website from companies where status = 'active' and website is not null`.
2. For each company, throttled to ~5 concurrent / ~1 req/sec:
   - `firecrawl.map(website, { search: 'careers jobs hiring', limit: 10 })` to find the careers page.
   - Pick the best candidate (URL contains `careers`, `jobs`, `join`, `work-with-us`, `hiring`). Fall back to the website root if nothing matches.
   - `firecrawl.scrape(url, { formats: [{ type: 'json', schema: { is_hiring: boolean, jobs: [{ title, location?, type?, url? }] } }] })`.
3. Writes:
   - `update companies set hiring_status = <bool>, updated_at = now() where id = ...`
   - `delete from job_postings where company_id = ... and ai_imported = true`
   - `insert into job_postings (...) values (...)` with `ai_imported = true, is_active = true`.
4. Returns `{ scanned, hiring, jobs_imported, errors, started_at, finished_at }`.

Trigger:
- Manual button on `/admin` ("Refresh hiring data") that calls the function and shows the last-run summary.
- (Optional, can defer) Daily `pg_cron` hitting a `/api/public/refresh-hiring` route guarded by a shared secret header — not in this first pass unless you want it now.

## 3. Realtime on `companies` and `job_postings`

Migration:
```sql
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.job_postings;
alter table public.companies replica identity full;
alter table public.job_postings replica identity full;
```

Then in `src/routes/map.index.tsx`:
- Subscribe to `postgres_changes` on `companies` (event `*`). On any change, patch the row in local state by `id` so the hero "Hiring now" stat, the marker color, and the card "Hiring" badge update without a refresh.
- Same approach on the company detail page (`map.company.$id.tsx`) so a single open card live-updates while the function writes.

## 4. Hiring data status line

A small status strip directly under the hero stats on `/map`, e.g.:

```text
Hiring data · updated 2 min ago · source: company careers pages via Firecrawl · [Refresh]
```

- "Updated" timestamp = `max(updated_at)` from `companies` filtered to rows touched by the last refresh. Cheap query, cached client-side, refreshed by the same realtime subscription.
- Status pill: `Idle` / `Refreshing…` / `Last run failed` based on the most recent run.
- "Source" text is static: "Company careers pages via Firecrawl".
- The `[Refresh]` button is admin-only (uses `has_role(auth.uid(), 'admin')`); for everyone else it's just the status text.
- To track runs cleanly, add a tiny `hiring_refresh_runs` table:
  - `id, started_at, finished_at, scanned, hiring, jobs_imported, error_count, status (running|success|failed)`
  - RLS: public read, admin write. Edge function inserts a row at start, updates it at end.

## Files

- NEW `supabase/functions/refresh-hiring/index.ts`
- NEW migration: realtime on `companies` + `job_postings`, create `hiring_refresh_runs` table with RLS
- EDIT `src/routes/map.index.tsx` — realtime subscription, status strip
- EDIT `src/routes/map.company.$id.tsx` — realtime subscription for the open company
- EDIT `src/routes/admin.tsx` — "Refresh hiring data" button + last 10 runs table
- `supabase/config.toml` — add `[functions.refresh-hiring]` block (no `verify_jwt = false`; admin button calls it with the user's JWT; admin check enforced inside the function)

## Open question

Do you want the daily cron (option in step 2) included now, or just the admin "Refresh" button for the first pass? The button is enough to prove it works; cron can come right after.
