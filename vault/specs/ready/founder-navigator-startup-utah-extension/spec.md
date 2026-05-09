---
slug: founder-navigator-startup-utah-extension
created: 2026-05-08
tags: [spec, golden-circle, hackathon, browser-extension, startupstate]
---
# Founder Navigator — Startup Utah Chrome Extension

## Why

Utah founders — both pre-incorporation and early-stage — face a discovery wall on `startup.utah.gov`: hundreds of programs across four lifecycle stages, none personalized, surfaced only through forms and long-form interviews founders don't have time for, so most abandon the site. The state's stake compounds the loss: GOED's corpus of grants, mentors, and incubators is underutilized, program ROI invisible, and Utah's pitch to international investors weakened by an experience that doesn't *show* the ecosystem working. A zero-friction layer that reads what founders already have (email, business docs) and personalizes the existing site *in situ* unlocks both sides: founders get to value in seconds; the state gets a corpus that finally works.

## How

Ship a Manifest V3 Chrome extension at `apps/browser/` that uses `chrome.identity.getAuthToken` for a single Google OAuth consent covering identity, Gmail readonly, and Drive readonly scopes. Authenticated calls hit the existing Convex deployment under an isolated `startupState` schema namespace (`founderProfiles`, `ingestedSignals`, `resourceCatalog`, `signalIngestRuns`) with no cross-pollination of Lotzoom domain tables. Founders pick any combination of three signal sources: a Gmail message sweep, a Drive folder, and a local-disk folder via the File System Access API. Each source streams parsed text to a Convex action that classifies stage / industry / geography / gaps and writes a versioned founder profile. A Convex pipeline ingests the GOED resource Google Sheet (CSV export) into typed `resourceCatalog` records with embedding vectors. A content script on `startup.utah.gov/*` mounts a sidecar overlay rendering three augmentations: (1) relevance-ranked badges on resource cards, (2) a "why this matters to you" side panel citing the founder's own artifacts, (3) a gap-analysis strip flagging missing lifecycle steps. Matching runs server-side against the indexed corpus.

**Key trade-offs:**
- **Chrome-only / MV3** — fastest to ship for hackathon; punts Firefox / Safari / Edge.
- **File System Access API** — no installer; founder re-grants per session. Native messaging deferred.
- **Convex-backed inference** — heavier than client-only but reuses existing AI infra (OpenRouter wrapper, embedding service) and gives provenance for citations.
- **Three augmentations together** — broader scope but each reads from the same profile, so cost is mostly in UI surface.
- **Hackathon-isolated namespace** — separate Convex tables prevent schema bleed without doubling deploy/env config.

### In Scope

- `apps/browser/` MV3 extension scaffolding (manifest, background service worker, popup, options page, content script) bundled with Vite + `@crxjs/vite-plugin`
- Single Google OAuth consent via `chrome.identity.getAuthToken` covering `userinfo.email`, `gmail.readonly`, `drive.readonly`
- Convex namespace `startupState` with new tables: `founderProfiles`, `ingestedSignals`, `resourceCatalog`, `signalIngestRuns`
- **Gmail signal source**: extension fetches recent threads (last 90 days, configurable cap) via Gmail API → Convex action → parsed signals
- **Drive signal source**: founder picks a Drive folder via the Google Picker; extension downloads supported text-extractable files (Docs, PDFs, plaintext) → Convex action → parsed signals
- **Local folder signal source**: File System Access API directory pick → recursive read of supported text/PDF files → Convex action → parsed signals
- Convex inference action that classifies signal batches into structured deltas (`stage`, `industries[]`, `geography`, `gaps[]`) and merges into a versioned `founderProfiles` document
- One-shot Convex import of the GOED resource Google Sheet CSV → `resourceCatalog` rows with the 9 native columns + `text-embedding-3-small` embedding (1536-dim)
- Content script mounted on `startup.utah.gov/*` rendering three augmentations:
  - Relevance ranking badges on resource cards (Top match / Strong / Maybe)
  - "Why this matters" side panel citing 1–3 founder-artifact snippets per card
  - Top-of-page gap-analysis strip listing 1–3 unmet lifecycle steps with program links
- Onboarding flow in the extension popup: source connection wizard with progress states and retry
- Demo-grade styling consistent with the hackathon's design judging criterion

### Out of Scope

- Firefox / Safari / Edge ports — Chrome-only for the hackathon
- Native messaging host for persistent local-folder watching — FSA picker per session is sufficient
- Augmentation on any site other than `startup.utah.gov` — content script matches narrow URL patterns only
- Utah Startup Map (Hackathon Part 2) — separate spec; tracked at `vault/todos/startupstate/utah-startup-map.md`
- Manual long-form interview / questionnaire UI — explicit anti-goal; voice / Socratic refinement tracked at `vault/todos/startupstate/agentic-voice-socratic-overlay.md`
- Lotzoom session reuse, marketing-site cookies, `crossDomainClient` — auth-isolated for hackathon
- Write access to Gmail / Drive — readonly scopes only
- PII redaction service or data-retention policy beyond defaults — flagged for a later compliance spec
- Mobile / iOS / Android clients
- Background re-ingest / scheduled refresh — on-demand only for v1; tracked at `vault/todos/startupstate/background-ingest.md`
- Multi-user / org / shared profiles — single-founder context only
- Direct edits to `startup.utah.gov` DOM — augmentation is non-destructive overlay; original DOM untouched on uninstall

### Acceptance Criteria

- [ ] **AC-1:** **Given** the unpacked `apps/browser/` extension loaded in Chrome and no prior session, **When** the founder opens the popup and clicks "Connect Google", **Then** a single OAuth consent screen requests `userinfo.email`, `gmail.readonly`, and `drive.readonly`, and on approval the popup shows the founder's email and a `founderProfiles` row appears in Convex keyed by Google `sub`.
- [ ] **AC-2:** **Given** an authenticated founder with Gmail messages in the last 90 days, **When** they trigger the Gmail sweep from the popup, **Then** within 60 seconds the popup reports a count of ingested messages, and a corresponding number of `ingestedSignals` rows with `source=gmail` exist in Convex with non-empty extracted text.
- [ ] **AC-3:** **Given** an authenticated founder, **When** they pick a Google Drive folder via the in-extension picker, **Then** every text-extractable file in that folder (Docs, PDFs, plaintext) produces an `ingestedSignals` row with `source=drive`, file name, and parsed text, and the popup reports per-file success/skip counts.
- [ ] **AC-4:** **Given** the founder grants File System Access API permission to a local directory, **When** they confirm the pick, **Then** every supported file in that directory produces an `ingestedSignals` row with `source=local`, relative path, and parsed text, and unsupported files are skipped with a visible reason in the popup.
- [ ] **AC-5:** **Given** at least 3 ingested signals across any combination of sources, **When** the inference action runs, **Then** the `founderProfiles` document contains non-null `stage`, `industries[]` (≥1), `geography`, and `gaps[]` fields, plus a `version` integer that increments on each subsequent inference run.
- [ ] **AC-6:** **Given** the GOED resource Google Sheet CSV at the published URL, **When** the one-shot import runs (`bunx convex run startupState/resources:importSheet`), **Then** at least 200 `resourceCatalog` rows exist with `title`, `description`, `link`, `industries[]`, `topics[]`, `locations[]`, and a non-null embedding vector.
- [ ] **AC-7:** **Given** an authenticated founder with a hydrated profile and a populated resource catalog, **When** they navigate to `https://startup.utah.gov/`, **Then** the content script mounts and within 3 seconds (a) at least one resource card on the page displays a relevance badge (Top match / Strong / Maybe), (b) a top-of-page gap-analysis strip lists 1–3 unmet steps with links to programs, and (c) hovering or clicking any badged card opens a side panel quoting at least one snippet from the founder's own ingested signals with source attribution.
- [ ] **AC-8:** **Given** the extension is enabled, **When** the founder navigates away from `startup.utah.gov` to any other site, **Then** no overlay, content script, or DOM mutation occurs on the other site, and **When** the extension is disabled or uninstalled, **Then** `startup.utah.gov` renders identically to a fresh-Chrome-profile baseline.

### User Flows

**Happy Path:** First-time founder demo
1. Founder loads the unpacked extension in Chrome and opens the popup.
2. Popup shows a single "Connect Google" CTA. Founder clicks it.
3. Single OAuth consent screen requests userinfo + Gmail readonly + Drive readonly. Founder approves.
4. Popup advances to a "Connect signal sources" view with three rows: Gmail, Google Drive, Local folder — each with a "Connect" button and a status pill.
5. Founder clicks Gmail → "Sweep last 90 days". Status pill animates "Ingesting…" with a running count. On completion: "Ingested 247 messages."
6. Founder clicks Drive → "Pick folder", chooses a "Business" folder. Status pill: "Ingested 18 files (3 skipped — unsupported format)."
7. Founder clicks Local folder → "Pick directory", grants FSA permission to `~/Documents/Startup`. Status pill: "Ingested 11 files."
8. Popup shows a "Profile ready" badge with inferred chips: stage, industries, geography, gaps.
9. Founder navigates to `https://startup.utah.gov/`. Content script mounts.
10. Within 3 seconds the page renders: top gap-analysis strip ("3 steps you haven't completed yet"), and resource cards now display Top match / Strong / Maybe badges.
11. Founder hovers a "Top match" card — side panel slides in quoting an email subject and a Drive doc snippet that triggered the match, with "View source" links.
12. Founder clicks the resource link and proceeds; site integrity is preserved (no rewrites, only overlay).

**Error: OAuth scope denial**
1. Founder clicks "Connect Google" in the popup.
2. On the consent screen, founder unchecks the Gmail scope and approves only Drive + userinfo.
3. Popup detects the missing scope, displays a non-blocking warning ("Gmail not connected — your profile will be inferred from Drive and local files only") and a "Reconnect with Gmail" link.
4. Drive ingest, local-folder ingest, profile inference, and on-site augmentation all proceed normally with available signals.
5. Snippet citations in the side panel reference only the connected sources; no fabricated Gmail attribution.

**Error: Empty / sparse signals**
1. Authenticated founder has fewer than 3 signals after attempting all three sources (e.g., empty mailbox, no folder picked, no local files).
2. Popup shows a "Profile not ready — connect more sources" state with the three source rows still actionable.
3. On `startup.utah.gov`, the content script detects the un-hydrated profile and renders a single inline banner ("Connect your business signals to personalize this page") with a deep link back to the popup, but no badges, no gap strip, no side panel.
4. Site integrity preserved; founder can dismiss the banner and use the site as-is.

## What

### System Boundaries

- **`apps/browser/`** (new): MV3 manifest, Vite + `@crxjs/vite-plugin` bundler, popup React app, options page, background service worker, content script for `startup.utah.gov/*`, OAuth flow via `chrome.identity`, FSA folder picker, Drive picker module
- **`convex/startupState/`** (new namespace): `auth.ts`, `ingest.ts` (Gmail / Drive / local actions), `profile.ts` (inference + versioning), `resources.ts` (import + match query)
- **`convex/schema/startupState.ts`** (new): `founderProfiles`, `ingestedSignals`, `resourceCatalog`, `signalIngestRuns` tables
- **`convex/lib/`** (new wrappers): `googleIdentityService.ts`, `gmailService.ts`, `driveService.ts`, `openaiEmbeddingsService.ts`; reuses existing `generateObjectOpenRouter.ts`
- **`e2e/extension/`** (new): Playwright extension fixture, OAuth/FSA stubs, Convex seeding helper, smoke test for AC-7 / AC-8
- **`vitest.config.mts`**: extend test glob to include `convex/startupState/**/*.test.ts`
- **`playwright.config.ts`**: add a project for the extension fixture (separate from existing Metro target)

### Feedback Harnesses

Every AC has an automated feedback loop. Manual feedback is exceptional and justified.

| AC | Fidelity | Layer(s) | Trigger | Observable Seam | Terminal Condition | Test Infra |
|----|----------|----------|---------|-----------------|--------------------|------------|
| AC-1 | live (backend) + integration (frontend) | `backend` (Vitest/convex-test) + `e2e` (Playwright + extension fixture) + `external:google.identity` | `bunx convex run startupState/auth:registerFounder` with a fixture-signed Google ID token; Playwright loads unpacked extension + stubs `chrome.identity.getAuthToken` to return a fixture token | Convex `founderProfiles` row keyed by Google `sub`; popup DOM showing founder email | Row exists with expected `sub`, `email`, `connectedScopes[]`; popup renders email within 1s of stub callback | new — Playwright extension fixture (persistent context + `--load-extension`); new — Google ID token verification helper in `convex/lib/googleIdentityService.ts` |
| AC-2 | integration | `backend` (Vitest/convex-test) + `external:gmail` | Vitest seeds an authenticated founder; calls `startupState/ingest:sweepGmail` action with `vi.spyOn(globalThis, "fetch")` mocked to return Gmail `messages.list` + `messages.get` fixtures | Convex `ingestedSignals` rows with `source="gmail"`, `externalId`, extracted text | Row count equals fixture message count (≥3); each row has non-empty `extractedText` and `provenance.source="gmail"` | exists — fetch-spy mocking pattern (see `convex/lib/ffmpegRunnerService.test.ts`); new — Gmail wrapper `convex/lib/gmailService.ts` |
| AC-3 | integration | `backend` (Vitest/convex-test) + `external:drive` | `startupState/ingest:sweepDrive` action invoked with mocked Drive `files.list` + `files.export` fixtures (Doc, PDF, plain) | `ingestedSignals` rows with `source="drive"`, file name, MIME, parsed text | Row count = supported-fixtures count; skipped files surface in action return value with reason | new — Drive wrapper `convex/lib/driveService.ts`; new — PDF text-extraction helper |
| AC-4 | integration (frontend) + live (backend) | `e2e` (Playwright + extension fixture) + `backend` | Playwright stubs `window.showDirectoryPicker` to return a fixture FileSystemDirectoryHandle; founder confirms in popup; extension posts parsed text to live Convex via `startupState/ingest:writeLocalSignals` | Popup status pill text + Convex `ingestedSignals` rows with `source="local"` | Pill reads "Ingested N files (M skipped)"; row count = supported fixture count | new — Playwright FSA stub helper; new — local-folder parser in `apps/browser/src/ingest/local.ts` |
| AC-5 | live | `backend` (Vitest/convex-test) + `external:openrouter` | Seed ≥3 signals across mixed sources; call `startupState/profile:runInference` action with OpenRouter response stubbed via `vi.spyOn(globalThis, "fetch")` to return a structured-JSON fixture | Convex `founderProfiles` doc fields + `version` integer | `stage` non-null, `industries.length ≥ 1`, `geography` non-null, `gaps[]` present; `version` increments by 1 across two consecutive runs | exists — `generateObjectOpenRouter` wrapper + fetch-spy pattern |
| AC-6 | live | `backend` (Vitest/convex-test) + `external:openai.embeddings` | `bunx convex run startupState/resources:importSheet --csvUrl <fixture>` against dev Convex; embedding endpoint stubbed in CI via fetch-spy returning deterministic vectors | `resourceCatalog` rows count + per-row field shape | ≥200 rows; every row has non-empty `title`, `link`, `industries[]`, `topics[]`, `embedding` (1536-dim vector) | new — sheet/CSV importer; new — `convex/lib/openaiEmbeddingsService.ts`; new — fixture CSV in `convex/startupState/__fixtures__/` |
| AC-7 | live | `e2e` (Playwright + extension fixture) + live Convex | Playwright loads unpacked extension w/ stubbed OAuth + seeded Convex profile + catalog; navigates to `https://startup.utah.gov/` (real site, retried + asserted via DOM not visual) | DOM markers `[data-startupstate-badge]` on resource cards, `[data-startupstate-gap-strip]` at top, `[data-startupstate-side-panel]` after hover; computed timing | (a) ≥1 card has a badge within 3000 ms; (b) gap strip lists 1–3 items with valid `href`; (c) hover renders panel with ≥1 quoted snippet whose text appears in seeded `ingestedSignals` | new — Playwright extension fixture + Convex seeding helper; new — content-script DOM markers |
| AC-8 | integration | `e2e` (Playwright + extension fixture) | Same fixture; navigate to `https://example.com/`; then unload extension, navigate to `https://startup.utah.gov/` and capture baseline DOM | `document.documentElement.outerHTML` mutation diff between baseline (no ext) vs. extension-on-non-matching-URL | Zero injected nodes outside `startup.utah.gov`; on `startup.utah.gov` with extension off, no `data-startupstate-*` attributes anywhere | new — DOM-diff helper that filters CSP-injected style noise |

<!-- Feedback Harness column definitions:
- Fidelity: live = real service interaction. integration = multiple real components, mocks only at true external boundaries. isolated = unit tests with mocks. manual = human-only.
- Layer(s): backend = Vitest (convex/**/*.test.ts), frontend = web/RN unit tests, e2e = Playwright (e2e/), external:{service} = contract test
- Trigger: what initiates the feedback loop
- Observable Seam: observable behavior to inspect (not source code)
- Terminal Condition: concrete assertion proving the AC passed
- Test Infra: exists / partial / new — describe what covers or is missing -->

### External Dependencies

| Service | Functionality In Scope | Integration Status | Env Var | Est. Cost/Call | Test Budget (total) |
|---------|------------------------|--------------------|---------|---------------|---------------------|
| Google OAuth (chrome.identity) | Single-consent auth for userinfo + Gmail readonly + Drive readonly; server-side ID-token verification | new — wrapper `convex/lib/googleIdentityService.ts` to verify ID tokens against Google's JWKs | `STARTUPSTATE_GOOGLE_CLIENT_ID` | Free | $0 |
| Gmail API | List + fetch messages (last 90 days) for an authenticated founder; extract subject + body text | new — wrapper `convex/lib/gmailService.ts`; uses caller-supplied access token | (uses OAuth token) | Free (1B units/day shared quota) | $0 |
| Google Drive API | List files in a chosen folder; export Docs as plain text; download PDFs / plaintext | new — wrapper `convex/lib/driveService.ts`; uses caller-supplied access token | (uses OAuth token) | Free (1B queries/day shared quota) | $0 |
| Google Sheets CSV export | One-shot fetch of the published GOED resource sheet CSV for catalog import | new — inlined `fetch` in `convex/startupState/resources.ts` (anonymous URL, no wrapper needed) | (none) | Free | $0 |
| OpenRouter | Structured-JSON classification of ingested signals → `{ stage, industries[], geography, gaps[] }` | existing — `convex/lib/generateObjectOpenRouter.ts` already wired | `OPENROUTER_API_KEY` | ~$0.005/call (Claude Haiku class) | $5 |
| OpenAI Embeddings | Embedding vectors for `resourceCatalog` rows and `ingestedSignals` matching; `text-embedding-3-small` (1536-dim) | new — wrapper `convex/lib/openaiEmbeddingsService.ts` | `OPENAI_API_KEY` | ~$0.000004/1K tokens | $5 |

<!-- Column definitions:
- Integration Status: existing = wrapper + endpoint wired. partial — describe what exists / what's missing. new — describe what to build.
- Env Var: Convex env var name. For existing wrappers, read from headers()/availability check. For new, use convention.
- Est. Cost/Call: Free = $0. Cheap < $0.10. Expensive ≥ $0.10. Unknown when pricing requires auth.
- Test Budget (total): Dollar ceiling for ALL real API calls during implementation + testing. -->

### Pre-Implementation Setup Notes

**Google Cloud OAuth client setup** (one-time, before implementation can run end-to-end):

0. **Use a dedicated Cloud project**, not the LotZoom production project. The OAuth consent screen is project-wide; adding restricted Gmail/Drive scopes to LotZoom would force a CASA security review or break sign-in for real users. The hackathon project is `Startup-Utah-gov 5io Navigator` under `jsnbuchanan@gmail.com`.
1. Pin the extension ID by adding a `key` field to `apps/browser/manifest.json` (load the unpacked extension once, copy its `chrome://extensions` ID, then export a public key into the manifest so the ID is stable across machines and Playwright fixtures).
2. In Google Cloud Console (in the hackathon project) → Google Auth Platform → Clients → **Create OAuth client ID**, choose **Application type: Chrome Extension** (NOT Web application — `chrome.identity.getAuthToken` validates against the extension ID, not a redirect URI).
3. Enter the stable extension ID under "Application ID". Skip "Verify app ownership" — that's for Web Store-published extensions only.
4. Enable Gmail API and Drive API on the hackathon Cloud project.
5. Configure OAuth consent screen → Testing mode → add hackathon teammates + judges as Test users. Required for restricted scopes.
6. Add the OAuth client ID to `manifest.json` under `"oauth2": { "client_id": "...", "scopes": [...] }` with scopes `userinfo.email`, `gmail.readonly`, `drive.readonly`.
7. Set `STARTUPSTATE_GOOGLE_CLIENT_ID` Convex env var to the same client ID — used server-side to verify ID tokens against Google's JWKs. Distinct from `GOOGLE_CLIENT_ID` used by LotZoom auth.
8. The downloaded `client_secret_*.json` file goes in 1Password as a Secured File — never committed.

If a different OAuth path is needed later (e.g., supporting Edge or a web-only fallback), a separate **Web application** type client with redirect URIs would be added; not needed for the hackathon scope.

### Source Materials

- Hackathon brief: https://startupstate.netlify.app/?referrer=luma&utm_source=luma
- GOED resource catalog (CSV source): https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing
- Map data (Hackathon Part 2 — out of scope): https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing
- Reference startup map: https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN
- Target augmentation site: https://startup.utah.gov/

### Follow-on Work

Captured in `vault/todos/startupstate/`:
- `background-ingest.md` — scheduled / event-driven re-ingest after v1
- `agentic-voice-socratic-overlay.md` — Socratic profile refinement via voice on the augmented page
- `utah-startup-map.md` — Hackathon Part 2 (Utah Startup Map)
