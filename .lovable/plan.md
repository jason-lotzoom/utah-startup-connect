# Hackathon Close-Out — All 6 Items

Implementing every priority item from the assessment, in this order so each step builds on the previous one. Approve to ship.

---

## 1. Persona QA + Navigator tag fixes

**Goal:** All 6 brief personas (Jordan, Maria, Marcus, Priya, David, Dr. Amir) get meaningfully different recommendations.

- Add a one-time SQL data fix on `resources` to ensure `communities`, `industries`, `stages`, and `locations` arrays are populated for the obvious cases (women, veterans, rural, students, university tech-transfer, growth-stage international, medtech/FDA, angel/VC).
- Update the matching scorer in `src/routes/navigator.tsx` to:
  - hard-boost resources whose `communities` overlap quiz `community`
  - hard-boost resources tagged with the user's county/region
  - score `stages` and `industries` as additive, not multiplicative (so a great-stage match still surfaces even if industry tag is missing)
- Add a small **"Why this matched"** line under each recommendation showing which tags fired (stage / community / industry / location).

## 2. `/map` filters + investor strip

`src/routes/map.index.tsx`:

- Add filter chips bar above the map: **Sector** (multi), **Stage**, **Size** (employee bucket), **Hiring now** (toggle), **County** (dropdown). State lives in URL search params so links are shareable.
- Apply the filters to both the marker layer and the side list.
- Add an **"Ecosystem at a glance"** strip across the top: total visible companies, % hiring, top 3 sectors, new-this-week count, total open roles. Single Supabase query, computed client-side from filtered set.

## 3. Domain-match auto-verify (lightweight verification)

`src/routes/map.claim.$id.tsx` + new server function:

- Create `src/lib/claims.functions.ts` with `submitClaim` server fn (uses `requireSupabaseAuth`).
- Server logic: extract domain from `companies.website`, compare to the email's domain on the submitter's auth user (`session.user.email`). If they match, set `companies.is_claimed = true`, `claimed_by = user.id`, `is_verified = true`, and insert a `claim_requests` row with `status = 'auto_approved'`. Otherwise insert with `status = 'pending'` (current behavior).
- UI: show a green "Auto-verified — your email matches the company domain" banner on success, otherwise the existing "we'll review" message.
- Migration: add `auto_approved` as a valid `claim_requests.status` value (no constraint exists today, so this is just a convention — no schema change needed).

## 4. `/map` visual port from hero

`src/routes/map.index.tsx` + reuse the look from `HeroLiveMap`:

- Switch Mapbox style to the same light style, apply parchment tint overlay, hide all Mapbox chrome (reuse `.hero-map-wrap` CSS scope or extract to `.brand-map-wrap`).
- Replace generic markers with the brand pin component (logo circle + sector ring + hiring pulse dot).
- Color sector chips with the same `--sector-*` tokens used on the hero.

## 5. Company page polish + per-route SEO

`src/routes/map.company.$id.tsx`:

- Convert the loader to a TanStack Query `ensureQueryData` pattern so `head()` can read `loaderData` and emit per-company `<title>`, `<meta description>`, `og:title`, `og:description`, `og:image` (uses `logo_url` or first photo).
- Photo gallery: simple lightbox on click (no new dep — use Radix `Dialog`).
- Each job posting gets an "Apply" button linking to `job.url` in a new tab.
- Add a "Share" button (copies current URL, toast confirmation).

Per-route SEO sweep: add `head()` with unique title/description/og to `/capital`, `/jobs`, `/events`, `/ecosystem`, `/navigator`.

## 6. Founder Snapshot share card

`src/routes/navigator.tsx` (final step):

- Add a "Save / Share my matches" button that opens a dialog with:
  - Plain-text copy of the top 5 matches (one click → clipboard).
  - **"Open share card"** link → new route `/navigator/snapshot` that renders a 1200×630 styled card (parchment bg, canyon-red accent, "Jordan, pre-seed, SLC — 6 matches from 5iO") using HTML/CSS only, suitable for screenshot or as an OG image.
  - "Email me this list" → opens `mailto:` with prefilled subject + body (no backend needed).
- The snapshot route's `head()` sets `og:image` to a fixed branded asset (the brand image already in `/src/assets`) so the URL itself is shareable on Twitter/LinkedIn.

---

## Files touched (all frontend + one tiny server fn)

- `src/routes/navigator.tsx` — scorer, "why this matched", share dialog
- `src/routes/navigator.snapshot.tsx` — new shareable card route
- `src/routes/map.index.tsx` — filters, investor strip, brand pins, parchment tint
- `src/routes/map.company.$id.tsx` — gallery lightbox, share, apply CTAs, per-page SEO via loader
- `src/routes/map.claim.$id.tsx` — domain-match success state
- `src/lib/claims.functions.ts` — new `submitClaim` server fn
- `src/routes/{capital,jobs,events,ecosystem}.tsx` — `head()` SEO additions
- `src/styles.css` — extend `.brand-map-wrap` selectors to cover `/map`
- One small data-cleanup migration on `resources` tags

## Out of scope

- No new tables, no auth changes, no edge functions added.
- Hero, header, and global nav stay as they are.

Approve and I'll start with #1 and ship straight through #6.
