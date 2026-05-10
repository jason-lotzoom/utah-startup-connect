# apps/browser — context for Claude

This directory implements a Manifest V3 Chrome extension. It is **not** React Native (that's `apps/app`) and **not** an Astro site (that's `apps/marketing`). Frontend conventions from those folders do not transfer cleanly — read this file before assuming.

## Spec

The driving spec is `vault/specs/draft/founder-navigator-startup-utah-extension/spec.md` (or its `vault/specs/ready/` / `vault/specs/implemented/` location after lifecycle promotion). When in doubt about scope, behavior, or fidelity of feedback loops, read the spec — don't infer from existing code.

Follow-on todos at `vault/todos/startupstate/`. Do not pull these into this spec's scope without explicit instruction.

## Build system

- **Bundler: Vite + `@crxjs/vite-plugin`.** Not webpack. Not esbuild standalone. Not Metro.
- Output goes to `apps/browser/dist/` — that's what gets loaded as the unpacked extension.
- Dev mode (`bun --filter @lotzoom/browser dev`) does live HMR for popup / options / content scripts via crxjs.
- The package name in `apps/browser/package.json` is `@lotzoom/browser`.

## Production zip packaging

When producing a versioned production zip (`founder-navigator-<version>-<YYYYMMDD>.zip`):

- **EXCLUDE `*.map` files.** Sourcemaps inflate the zip ~4x and have no use in the published artifact. The vite config keeps `build.sourcemap: true` so local debugging in `dist/` still works.
- Run from `apps/browser/`:
  ```
  (cd dist && zip -rq "../founder-navigator-<version>-<date>.zip" . -x '*.map')
  ```
- Always rebuild (`bun run build`) before zipping so `dist/` reflects the bumped manifest version.
- Replace any prior versioned zip in `apps/browser/` (`git rm -f` the old one) so only the current zip lives at the repo root for the extension folder.

## OAuth — read this before touching auth code

This extension uses **`chrome.identity.getAuthToken`** with a Google Cloud OAuth client of type **Chrome Extension** (not Web application).

- The OAuth client lives in a **separate Google Cloud project** (`Startup-Utah-gov 5io Navigator`, owner `jsnbuchanan@gmail.com`) — not the LotZoom production Cloud project. Do not propose moving it back to the LotZoom project: the OAuth consent screen is project-wide and adding restricted Gmail/Drive scopes there would either trigger CASA verification or break LotZoom production sign-in. README has the full rationale.
- The OAuth client ID lives in **two** places that must stay in sync:
  - `apps/browser/manifest.json` → `oauth2.client_id`
  - Convex env var `STARTUPSTATE_GOOGLE_CLIENT_ID` (used server-side by `convex/lib/googleIdentityService.ts` to verify ID tokens). Distinct from the existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` used by LotZoom auth — do not consolidate.
- The extension ID is pinned via the `"key"` field in `manifest.json`. **Never regenerate the keypair without coordinating** — the ID changes, every teammate's Chrome breaks, every CI run fails.
- `key.pem` is in `.gitignore` and must stay there. The base64 `key` field in the manifest is the *public* counterpart and is intentionally committed.
- Do not propose switching to `chrome.identity.launchWebAuthFlow` or a Web-application-type OAuth client unless explicitly asked — those exist for non-Google IdPs, offline-access refresh tokens, or cross-browser support, none of which are in this spec.

## Hackathon constraints

These trade-offs are deliberate. Don't undo them in refactors.

- **Chrome-only.** Firefox / Safari / Edge ports are explicitly out of scope. Don't add manifest_version 2 fallbacks, don't polyfill `browser.*` over `chrome.*`, don't add WebExtensions polyfill imports.
- **`startup.utah.gov`-only content script.** The `matches` glob in the manifest must stay narrow. Augmentation on other sites is out of scope and AC-8 explicitly forbids DOM mutation elsewhere.
- **Hackathon-isolated Convex namespace** (`startupState/*`). Do not import from or reuse: `convex/users`, `convex/accounts`, `crossDomainClient`, Better Auth helpers, the marketing-site cookie bridge, `getCurrentUserId`, `getAccountForUser`. Founder identity is keyed by Google `sub` in `founderProfiles`.
- **No long-form interview / questionnaire UI.** This is the explicit anti-goal of the product. If a flow starts to look like a form, push the work back to ambient signal ingestion.

## File structure expectations

The spec implies (but does not mandate the exact paths):

```
apps/browser/
  manifest.json
  package.json
  vite.config.ts
  tsconfig.json
  src/
    background/        # MV3 service worker
    popup/             # React popup app
    options/           # React options page (if needed)
    content/           # Content script for startup.utah.gov
    ingest/
      gmail.ts         # Gmail API calls (uses chrome.identity token)
      drive.ts         # Drive API + Picker
      local.ts         # File System Access API folder picker + parser
    auth/
      identity.ts      # chrome.identity wrapper + ID-token retrieval
    convex.ts          # Convex client wired to existing deployment
  dist/                # build output, gitignored
  key.pem              # private key, gitignored — DO NOT COMMIT
```

Companion backend code lives at:

```
convex/startupState/
  auth.ts          # registerFounder mutation (verifies Google ID token)
  ingest.ts        # sweepGmail / sweepDrive / writeLocalSignals actions
  profile.ts       # runInference action; profile read queries
  resources.ts     # importSheet action; matchResources query
convex/schema/startupState.ts   # founderProfiles, ingestedSignals, resourceCatalog, signalIngestRuns
convex/lib/
  googleIdentityService.ts
  gmailService.ts
  driveService.ts
  openaiEmbeddingsService.ts
```

## Testing

- Unit / integration: Vitest via `bun test:convex:once`. Use the `convex-test` runtime (existing pattern in `convex/lib/*.test.ts`). Mock external Gmail/Drive/OpenAI calls with `vi.spyOn(globalThis, "fetch")`.
- E2E: Playwright with a **new** extension fixture under `e2e/extension/`. The fixture must:
  - Launch with `--load-extension=<path-to-dist>` and `--disable-extensions-except=...`.
  - Stub `chrome.identity.getAuthToken` to return a fixture token (real OAuth in CI is not viable).
  - Stub `window.showDirectoryPicker` for AC-4 to return a fixture FileSystemDirectoryHandle.
  - Seed Convex via `bunx convex run` helpers before navigating to `startup.utah.gov`.
- The existing Playwright config targets Metro (port 8081); add a separate **project** for the extension fixture rather than overwriting Metro setup.

## Anti-patterns to avoid (Claude tends to do these)

- Mocking Convex queries in tests for ACs that are *about* those queries. Use convex-test against a real in-process DB.
- Reaching into `apps/app` or `apps/marketing` for shared components. Browser extension UI is its own design system; don't import React Native components into the popup.
- Adding a "Sign in with Google" web flow. There is exactly one auth path: `chrome.identity.getAuthToken`.
- Unconditionally injecting the content script on every site. The manifest `matches` must stay scoped to `https://startup.utah.gov/*`.
- Storing OAuth tokens in `chrome.storage` and rolling our own refresh logic. `chrome.identity` already handles token caching and refresh — call it every time you need a token.
- Adding a "use node" Convex action for any of the Google API calls. Use Web Crypto / fetch — the existing `convex/lib/aiProxy.ts` pattern works fine.

## When in doubt

- Re-read the spec before implementing.
- For OAuth/Cloud-Console questions, the README in this directory has the canonical setup steps.
- For pipeline / transformer / ledger conventions, see `convex/CLAUDE.md` — but note this hackathon namespace is intentionally lighter-weight than the Lotzoom domain pipelines.
