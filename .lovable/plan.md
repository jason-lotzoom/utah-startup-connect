# Navigator fixes & resource detail pages

## Issues to fix

1. **Chat says "0 matches" while page shows 50** — `ChatPanel` is rendered with `resultsCount={results?.length ?? 0}` and its initial message is captured once on first mount (when results are still `null`). It never updates when results arrive.
2. **Always 50 results / no real matching** — `rankResources` keeps every resource (score 0 included) and just slices the top 50, so the answer is the same regardless of quiz answers. Matching logic is also too literal (e.g. "Tech / Software" never substring-matches `topics` like "Software").
3. **External "Visit" links go straight off-site** — no internal landing/detail page for a program.
4. **One-column cards, no imagery** — list feels sparse.

## Plan

### 1. Smarter ranking + correct counts
- Rewrite `rankResources` to:
  - Tokenize quiz answers (split "Tech / Software" → ["tech","software"], lowercase).
  - Score against `topics`, `industries`, `locations`, `communities`, plus `title` / `description` (lower weight).
  - Heavy weight on community + location exact match, medium on industry/needs, low on text contains.
  - Filter out `score === 0`, cap at top 12 by default (still configurable via "show more" later).
- Remove placeholder 50-result behavior.

### 2. Chat reflects real result count
- Lift the greeting into a `useMemo` based on `resultsCount` (or rebuild the first assistant message via `useEffect` when `resultsCount` changes and the conversation is still at its initial state).
- Pass `loading` so the panel shows a "matching…" state instead of "0 matches".

### 3. Internal resource detail page
- Add `src/routes/navigator.resource.$id.tsx`:
  - Loads the resource by id (public read, RLS already allows it).
  - Shows hero image, title, full description, all tags (topics/industries/communities/locations), email, and a primary "Visit official site" external button (`link`, `target=_blank`).
  - Back link to `/navigator`.
  - SEO: `head()` with title/description from the resource.
- In the results list, the card itself becomes a `<Link to="/navigator/resource/$id">` (whole-card click). Keep a small secondary "Visit site ↗" external link inside the card for power users who want to skip the detail page.

### 4. Two-column cards with images
- Add an optional `image_url text` column to `public.resources` (nullable, no default) via migration so admins can curate cover art later.
- Render a 16:9 cover at the top of each card:
  - If `image_url` is set, use it.
  - Otherwise, render a deterministic branded gradient block (hash of `id` → hue) with the program initials as a fallback — keeps the grid visually consistent without bad stock photos.
- Grid: `grid sm:grid-cols-2 gap-5` (still single-column under `sm`).
- Card layout: image, then title, 3-line clamped description, top 3 topic badges, footer row with "View details →" and external "Visit ↗".

### 5. Admin polish (out of scope for this turn unless you want it)
- The `/admin` resources editor would need an `image_url` field. Flag for next pass — say the word and I'll wire it up.

## Files touched

```
src/routes/navigator.tsx                 (ranking, chat greeting, 2-col grid, cover image)
src/routes/navigator.resource.$id.tsx    (NEW — detail page)
supabase/migrations/<timestamp>.sql      (NEW — add resources.image_url)
```

No changes to backend functions, auth, or RLS.

## Verification

1. Reload `/navigator`, finish the quiz with e.g. Stage=Seed / Industry=Tech / Location=Salt Lake County / Needs=Capital → fewer than 50 results, ordered by relevance, chat greeting reads the actual count.
2. Cards display in two columns with cover art / gradient fallback.
3. Clicking a card opens `/navigator/resource/<id>` with the full description and a working external "Visit site" button.
4. `restart quiz` re-runs and chat greeting updates again.

Confirm and I'll build it. Want me to also add the `image_url` field to the admin editor in the same pass?
