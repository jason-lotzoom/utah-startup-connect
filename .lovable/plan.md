## Goal

Three things, all on the landing page (`/`):

1. **Fix the Get Started 404** — the button links to `/auth`, but only `/auth/login` and `/auth/signup` exist.
2. **Add a live concierge agent** that helps founders list their business on the Navigator / Startup Map without leaving the home page.
3. **Inline each tool** (Navigator, Map, Events, Jobs, Ecosystem) as its own interactive section on `/`, each with a small live preview + "View more →" CTA so users can explore everything without navigating away first.

---

## 1. Fix Get Started → 404

`src/routes/index.tsx:250` uses `<Link to="/auth">`. Switch to `/auth/signup` (logged-out users) and keep "My Dashboard" for logged-in. Add a redirect route at `src/routes/auth.tsx` (renders `<Navigate to="/auth/login" />`) so any other stale `/auth` links also work.

---

## 2. Landing-page Concierge Agent ("List your business" assistant)

A floating, always-available chat widget anchored bottom-right of `/` with a friendly opener:

> "Hi 👋 I'm 5iO Concierge. Want to list your startup on the Map, find resources in Navigator, or post a job? I'll guide you in 30 seconds."

Behaviour:
- Streaming chat (reuses the existing `navigator-chat` edge function pattern → new `concierge-chat` edge function with a system prompt focused on **listing flows**: Map company submission, Navigator resource intake, jobs, events).
- Smart action buttons appear inline in the AI replies: **"List my company on the Map"**, **"Submit a resource"**, **"Post a job"**, **"Add an event"** — each links to the matching add/claim page (`/map/add-company`, etc.) or opens an embedded mini-form when the user is logged in.
- Shows a "Sign in to continue" prompt with a link to `/auth/signup` if the user tries a write action while logged out.
- Persists conversation in `sessionStorage` only (no DB writes for v1).
- Collapsed by default as a pill button "Need help listing? Ask the Concierge"; expands into a 380×560 card.

Component: `src/components/ConciergeAgent.tsx`. Mounted once in `src/routes/index.tsx`.

---

## 3. Inline tool sections on `/` with live data + "View more"

Replace the current "Three tools, deeply connected" cards with **functional sections**. Each pulls real Supabase data, renders the top 4–6 results, and links to the full page.

### a) Navigator preview (`#navigator`)
- Mini-quiz: 3 quick chips ("Pre-seed", "Software", "SLC area") → calls existing matching logic, shows top 3 matched resources as cards.
- "View all 213 resources →" → `/navigator`.

### b) Startup Map preview (`#map`)
- Compact 320px-tall map with the existing `HeroLiveMap` (already on page) + sector filter chips + "Featured this week" carousel (latest 6 companies).
- CTAs: **"Explore full map →"** (`/map`) and **"List your company →"** (`/map/add-company`).

### c) Events preview (`#events`)
- Pulls next 4 upcoming events from `events` table; each card → `/events`.
- "View all events →" link.

### d) Jobs preview (`#jobs`)
- Top 6 jobs (uses existing `FALLBACK_JOBS` if DB empty). Filter chips by city.
- "View all jobs →" → `/jobs`.

### e) Ecosystem snapshot (`#ecosystem`)
- 4 stat tiles (companies, capital raised, sectors, hubs) + 6 logo grid of top investors/accelerators.
- "Explore ecosystem →" → `/ecosystem`.

Each section uses `<section id="...">` so the existing nav links scroll-anchor when clicked. All "View more" CTAs preserve full-page navigation for SEO.

### Layout pattern

```text
[ Hero map + search ]
[ Concierge floating button ─────────────► ]
[ § Navigator preview      → View all ]
[ § Startup Map preview    → Explore | List company ]
[ § Events preview         → View all ]
[ § Jobs preview           → View all ]
[ § Ecosystem snapshot     → Explore ]
[ Personas / footer (existing) ]
```

---

## Technical notes

- New edge function `supabase/functions/concierge-chat/index.ts` (mirrors `navigator-chat`, different system prompt, no resource-list grounding required).
- `ConciergeAgent.tsx` uses `react-markdown` for streaming responses (already in deps via Navigator).
- Each section is its own small component (`HomeNavigatorSection.tsx`, `HomeMapSection.tsx`, `HomeEventsSection.tsx`, `HomeJobsSection.tsx`, `HomeEcosystemSection.tsx`) inside `src/components/home/` for clean separation.
- All data fetched client-side with the public `supabase` client — no auth or RLS changes needed (existing tables are already readable).
- `auth.tsx` redirect route prevents future `/auth` 404s.

## Files touched

- **edit** `src/routes/index.tsx` — fix Get Started link, mount ConciergeAgent + 5 home sections.
- **new** `src/routes/auth.tsx` — redirect to `/auth/login`.
- **new** `src/components/ConciergeAgent.tsx`.
- **new** `src/components/home/HomeNavigatorSection.tsx`, `HomeMapSection.tsx`, `HomeEventsSection.tsx`, `HomeJobsSection.tsx`, `HomeEcosystemSection.tsx`.
- **new** `supabase/functions/concierge-chat/index.ts` (+ config entry if needed).

## Out of scope

- Persisting concierge chats to DB.
- Voice agent (ElevenLabs) — can come later if you want a true voice concierge.
- Redesigning the personas section (kept as-is).
