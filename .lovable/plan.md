## Goal

Let the live map breathe. Replace the giant "Navigate the Silicon Slopes" headline + paragraph with a small uppercase eyebrow above the search box, restore the pre-shrink pin styling, and turn each pin into a **circular company logo + name chip** (with an initial-monogram fallback when no logo exists).

## 1. Hero copy → "Tiny eyebrow only" (`src/routes/index.tsx`)

Remove the big `<h1>Navigate the Silicon Slopes.</h1>` and the long paragraph beneath it. Keep them out of the DOM entirely so the map is fully visible behind the search bar.

Replace with a single compact stack centered above the "Tell us about your startup…" search:

- The existing `Sparkles · Empowering the Utah Startup State` chip (kept).
- A small one-line eyebrow underneath: **"Navigate the Silicon Slopes"** rendered as `text-sm md:text-base`, uppercase, tracked-out, semi-transparent white — purely a label, not a headline.
- The search input + "Match Me" button (unchanged).
- The "Try:" example chips (unchanged).

Net effect: the hero collapses from ~500px of text to ~120px, so the map dominates the viewport.

The headline string ("Navigate the Silicon Slopes") moves into the page `<title>` / meta only — visible SEO is preserved through the route's `head()`.

## 2. Restore the previous map look (`src/styles.css`)

Roll back the recent shrinkage of `.hero-pin` / `.hero-pin-label` and the zoom threshold so the map feels like before:

- `HeroLiveMap.tsx`: `showLabels = zoom >= 9.5` (back from 12.5).
- `.hero-pin` is no longer the visual — it gets replaced by the new logo marker (see §3), but the CSS class stays as a fallback.
- New classes for the logo pin live alongside the old ones.

## 3. Logo + name pins (`src/components/HeroLiveMap.tsx` + `src/styles.css`)

### Marker structure

Each `<Marker>` renders a `<Link>` containing two stacked elements:

```text
   ┌─────────────┐
   │  ◯ logo     │   ← 24px round image, sector-colored ring + soft glow halo
   └─────────────┘
        ▲
   [ COMPANY NAME ]   ← name chip below, shown only at zoom ≥ 9.5
```

- **Logo**: `<img src={c.logo_url}>` inside a 24×24 `rounded-full` wrapper with `object-cover`, a 1px ring tinted by sector color, and a subtle `box-shadow` halo (replaces the pulsing dot). A faint `pin-pulse`-style outer ring keeps the "live" feel without being noisy.
- **Name chip**: same backdrop-blur uppercase chip we had before the shrink, sitting just below the logo.

### Fallback (initial monogram)

If `c.logo_url` is null/empty:

- Render a 24×24 round tile filled with the sector color at ~85% saturation.
- Centered uppercase first letter of `c.name` in white, `font-bold`, `text-[11px]`.
- Same ring + halo as the logo variant so the map looks visually consistent.

### Image safety

- Add `loading="lazy"` and an `onError` that swaps the `<img>` for the monogram fallback (handles broken URLs gracefully — no broken-image icons over the map).
- Wrap the `<img>` in a div with `overflow-hidden rounded-full bg-white/10` so transparent logos still look round on dark map.

### Query

The companies query stays the same shape but now also selects `logo_url`:

```text
select id, name, sector, hiring_status, latitude, longitude, logo_url
from companies
where status = 'active' and latitude is not null and longitude is not null
order by logo_url nulls last, hiring_status desc
limit 180
```

`order by logo_url nulls last` ensures the visible 180 prioritize companies that *have* a logo, so the map looks branded by default while the monograms still fill in the long tail.

## 4. Out of scope

- No changes to the cinematic flyTo cycle, sector legend, "LIVE · N startups tracked" chip, or stats banner — they stay exactly as they are now.
- No DB migrations. `logo_url` already exists on `companies`.
- No changes to `/map` route — only the hero map component.

## Files touched

- `src/routes/index.tsx` — strip the big H1 + paragraph, add a small eyebrow line above the search.
- `src/components/HeroLiveMap.tsx` — select `logo_url`, new marker JSX (logo + chip + monogram fallback), revert `showLabels` threshold to 9.5.
- `src/styles.css` — restore previous pin/label sizing; add `.hero-logo-pin`, `.hero-logo-pin img`, `.hero-monogram` classes with sector-colored ring + halo; keep `pin-pulse` keyframe.
