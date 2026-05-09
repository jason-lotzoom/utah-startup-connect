# Hero Map & Search Polish

Five focused changes — all frontend, no DB or backend work.

## 1. Repaint sector pins to the brand palette

Update `--sector-*` tokens in `src/styles.css` to draw only from Canyon Red, Sandstone, Desert Sky, plus dark/light variants of the same hues so every pin reads as part of the brand:

- Tech → Canyon Red (`oklch(0.52 0.16 38)`)
- Life Sciences → Desert Sky deep (`oklch(0.45 0.10 230)`)
- Aerospace → Desert Sky (`oklch(0.58 0.10 230)`)
- Energy → Sandstone (`oklch(0.78 0.09 55)`)
- Outdoor → Sandstone deep (`oklch(0.55 0.09 55)`)
- Manufacturing → Canyon Red muted (`oklch(0.42 0.12 38)`)
- Other → Night (`oklch(0.30 0.04 280)`)

Tighten `.hero-pin-label` to a parchment chip with Night text and Canyon Red border at 20% so it stays legible on cream. `.hero-logo-pin` keeps the white interior but the ring + halo use the new sector tokens, so logos pop without looking neon.

## 2. Strip Mapbox chrome from the hero map

In `src/components/HeroLiveMap.tsx`:
- Already passes `attributionControl={false}`. Confirm and also remove the logo via CSS (`.hero-map-wrap .mapboxgl-ctrl-logo { display: none; }` — Mapbox TOS allows this on paid plans; if not, shrink + dim it).
- Do NOT mount NavigationControl, ScaleControl, FullscreenControl, GeolocateControl (none currently used — keep it that way).
- Hide any default cluster controls and the bottom-left "Now viewing · …" hotspot chip on the home hero (it duplicates the LIVE chip and adds noise). Keep it on `/map` if reused.

CSS additions in `src/styles.css`:
```
.hero-map-wrap .mapboxgl-ctrl,
.hero-map-wrap .mapboxgl-ctrl-bottom-left,
.hero-map-wrap .mapboxgl-ctrl-bottom-right,
.hero-map-wrap .mapboxgl-ctrl-attrib { display: none !important; }
```

## 3. Header search: shorter, with clear button + suggest dropdown

In `src/routes/index.tsx`:
- Reduce search container from `flex-1 max-w-xl` to `w-[320px] lg:w-[380px]`, drop `mx-auto`, place it left of the auth button. Goal: visible but compact.
- Add an `X` button (lucide `X`) inside the input that appears when `aiSearch` is non-empty; clicking clears and refocuses.
- Build a lightweight client-side suggest dropdown (no new endpoint):
  - Pull a static list of curated query chips: `["Find seed capital", "Mentors in Lehi", "Biotech grants", "Hiring in Provo", "Rural programs", "Aerospace events"]`.
  - Plus dynamic matches from `companies.name` already loaded by `HeroLiveMap`. Lift the company list into the page via a callback (`onCompaniesLoaded`) added to `HeroLiveMap` props, or do a small parallel fetch in the nav (max 200 names, name + city only).
  - Render a `rounded-2xl` panel under the input with up to 6 results: companies first (with sector dot), then static suggestions. Keyboard arrows + Enter to pick. Click navigates: company → `/map/company/$id`, static → `/navigator?q=…`.
- Mobile: same X button; suggest panel appears below the mobile search field.

## 4. Clickable sector legend that filters pins

`src/components/HeroLiveMap.tsx`:
- Promote `activeSectors: Set<string> | null` to component state (null = show all). Filter `visibleCompanies` by sector membership.
- Export a `useSectorFilter` hook OR accept `activeSectors` + `onToggleSector` props from the page so the legend in `index.tsx` controls it.

`src/routes/index.tsx` legend block:
- Convert each row from `<div>` to `<button>` with `aria-pressed`. Inactive sectors render at 30% opacity with strikethrough dot ring; active sectors render full color.
- Add a small "All" reset button at the bottom of the panel when any filter is active.
- Update legend container styling to feel interactive: `hover:bg-white/90 cursor-pointer`, focus ring in Canyon Red.

## Files touched

- `src/styles.css` — sector tokens, label chip, Mapbox chrome hide, legend button styles
- `src/components/HeroLiveMap.tsx` — sector filter prop, hide hotspot chip on hero, expose company list for suggest
- `src/routes/index.tsx` — shorter header search, X button, suggest dropdown, clickable legend, sector filter state

## Out of scope

- No changes to `/map` page, DB, edge functions, or auth.
- No new geocoding API for search (suggest is local-only).
- No changes to flyTo cycle timing or stats banner content.
