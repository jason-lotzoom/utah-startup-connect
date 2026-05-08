# Fix the Map page: real map + real hiring data

## What's actually broken

1. **Interactive map offline** — `VITE_MAPBOX_TOKEN` is not present in the build. Mapbox needs a *build-time* `VITE_…` variable, which on Lovable lives in **Workspace Settings → Build Secrets** (not the runtime secrets I can add for you). All 220 companies already have lat/long, so the moment the token is in the build, the map renders.
2. **Hiring = 0** — every row in `companies.hiring_status` is `false`, and `job_postings` is completely empty (0 rows). Nothing is wrong with the UI; there is just no hiring data in the database. It needs to be populated.

## Plan

### 1. Mapbox token (you do this once)
- You add `VITE_MAPBOX_TOKEN` in **Workspace Settings → Build Secrets** with a Mapbox public token (`pk.…` from account.mapbox.com).
- Next build picks it up automatically; the offline card disappears and the dark map with 220 markers renders. No code change needed — the route already supports it.

### 2. Real hiring data via Firecrawl
Link the existing **FireCrawl Meetup** connector to this project, then add a backend job that does the work:

- New edge function `refresh-hiring` (server-only, uses `FIRECRAWL_API_KEY`):
  - Pulls every active company that has a `website`.
  - Calls Firecrawl `map` to find a careers/jobs page (`/careers`, `/jobs`, `/join-us`, `/work-with-us`, etc.).
  - Calls Firecrawl `scrape` on the best candidate with structured JSON extraction, schema:
    ```
    { is_hiring: boolean, jobs: [{ title, location?, type?, url? }] }
    ```
  - Updates `companies.hiring_status` and replaces that company's rows in `job_postings` (sets `ai_imported = true`, `is_active = true`).
  - Throttled (e.g. 5 concurrent, ~1 req/sec) to stay inside Firecrawl rate limits and credit budget.
  - Returns `{ scanned, hiring, jobs_imported, errors }`.

- Trigger options (pick in the questions below):
  - **Admin button** in `/admin` to run on demand + show last-run summary.
  - **Daily cron** via `pg_cron` hitting `/api/public/refresh-hiring` with a shared secret header.

- Realtime: enable Supabase Realtime on `companies` and `job_postings` so the Map page hero stat ("Hiring now") and per-card "Hiring" badge update live as the function writes results — no refresh needed.

### 3. Map page polish (small)
- Hero "Hiring now" stat already reads `companies.hiring_status`; once #2 runs it becomes accurate. Add a tiny "Updated <relative time>" line under the stats so users see the data is fresh.
- Marker color stays: amber = not hiring, primary = hiring.

## Files

- NEW `supabase/functions/refresh-hiring/index.ts` — Firecrawl map + scrape + DB writes, service-role client.
- NEW `src/routes/api/public/refresh-hiring.ts` — thin public proxy guarded by `REFRESH_HIRING_SECRET` (only if you pick the cron option).
- EDIT `src/routes/map.index.tsx` — add realtime subscription on `companies`, add "Updated …" line.
- EDIT `src/routes/admin.tsx` — add "Refresh hiring data" button + last-run summary (only if you pick the admin option).
- Migration — enable realtime on `companies`, `job_postings`; optional `pg_cron` schedule.

## What I need from you

I'll ask the questions next so I can build the exact right version.
