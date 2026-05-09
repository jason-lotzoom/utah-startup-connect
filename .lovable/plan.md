## Goal

Every company pin on the homepage map currently shows a colored monogram because **0 of 253 active companies have a `logo_url`**. All 253 do have a `website`. Fix this by populating `companies.logo_url` for the whole map.

## Approach

Use Clearbit's free Logo API (`https://logo.clearbit.com/{domain}`) — it covers the vast majority of real businesses, requires no API key, and returns a clean transparent PNG. The existing `LogoPin` component in `HeroLiveMap.tsx` already falls back to the monogram on `onError`, so any domain Clearbit doesn't have just renders the same way it does today — no regression.

### Step 1 — One-shot SQL backfill (covers ~all 253)

Run a single migration that derives the domain from `website` and sets:
```
logo_url = 'https://logo.clearbit.com/' || <hostname stripped of www. and path>
```
for every active company where `logo_url` is null/empty and `website` is a valid http(s) URL. This is instant, deterministic, and covers all 253 rows in one pass.

### Step 2 — Optional cleanup pass for misses

After the backfill, browser `<img onError>` will hide any Clearbit 404s and fall back to the monogram automatically — no user-visible breakage. For the small set that 404s, the existing admin-only `fetch-logos` edge function (Clearbit HEAD check + Firecrawl scrape fallback) can be re-run later to upgrade those rows from `logo.clearbit.com/...` to a real scraped image. **Not required for this task** — listed only so you know the path to perfect coverage exists.

## Files Touched

- **New migration** under `supabase/migrations/` — single `UPDATE companies SET logo_url = ...` statement scoped to active rows missing a logo.

No frontend changes needed — `HeroLiveMap.tsx` already renders `logo_url` and falls back gracefully.

## Out of Scope

- No new tables, no schema changes
- No edge function changes
- No changes to the company detail page or other surfaces (they already read `logo_url`)
