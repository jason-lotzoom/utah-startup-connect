# Founder Navigator — Chrome Extension

A Manifest V3 Chrome extension that personalizes [startup.utah.gov](https://startup.utah.gov/) for Utah founders. Built for the Utah GOED Builder Day hackathon (Part 1: Founder's Navigator).

The extension reads ambient signals from a founder's Gmail, Google Drive, and a local business-docs folder, infers their stage / industry / geography / gaps via the Convex backend, and overlays the live `startup.utah.gov` site with relevance-ranked badges, a gap-analysis strip, and contextual side-panel citations from the founder's own artifacts.

Spec: `vault/specs/implemented/founder-navigator-startup-utah-extension/spec.md`
End-user walkthrough: [`TUTORIAL.md`](./TUTORIAL.md)

---

## Prerequisites

- **bun** (no npm / yarn — repo policy)
- **Chrome** (Stable, latest) — the extension is Chrome-only
- **Convex CLI** (`bunx convex --help`)
- **OpenSSL** (for one-time keypair generation)
- A **dedicated Google Cloud project** you can administer (see "Why a separate Cloud project" below)
- An **OpenAI API key** (for embeddings) — optional during scaffolding, required for resource matching

---

## One-time setup: Google OAuth (Chrome Extension type)

This is the most fiddly piece. Read carefully — picking the wrong OAuth client type or skipping the key-pinning step will burn an hour later.

### Why a separate Google Cloud project

This extension lives in a **dedicated** Cloud project, not the existing LotZoom Cloud project. The reason: the OAuth **consent screen** (audience mode, test-user list, scope catalog, branding, verification status) is project-wide, not per-client. Adding the hackathon's restricted scopes (`gmail.readonly`, `drive.readonly`) into the LotZoom project would either (a) require Google's CASA security review for those scopes if LotZoom is in Production mode, or (b) force LotZoom's consent screen back to Testing mode, breaking sign-in for real users.

Project isolation eliminates the risk completely. After the hackathon you can delete the project cleanly without touching production.

**Current Cloud project:** `Startup-Utah-gov 5io Navigator` (owned by `jsnbuchanan@gmail.com`).

If you need admin access to the project for OAuth client management, ask Jason to add you as an Owner or Editor.

### 1. Pin a stable extension ID

Chrome assigns extension IDs by hashing the path of the unpacked folder, which means **every teammate gets a different ID** unless you embed a public key in the manifest. Do this once, commit it, and every developer + CI runner gets the same ID.

```bash
cd apps/browser

# Generate a keypair (private key — DO NOT COMMIT)
openssl genrsa 2048 > key.pem

# Print the public key, base64-encoded — this goes in manifest.json under "key"
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | base64 | tr -d '\n'
echo

# Compute the deterministic 32-char extension ID this key produces
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null \
  | openssl dgst -sha256 -binary \
  | head -c 16 \
  | xxd -p \
  | tr '0-9a-f' 'a-p'
echo
```

- Add the **base64 public key** to `apps/browser/manifest.json` as the `"key"` field. **Commit it.** It's public.
- The 32-char string (lowercase a–p only, e.g. `gjknjjnomofkimkdpdijkajbmocaeflk`) is your **Extension ID** / **Item ID**. Save it — you'll paste it into Google Cloud in step 3.
- Add `apps/browser/key.pem` to `.gitignore`. **Never commit the private key.** It's only needed if you later sign the extension for Web Store distribution; the runtime OAuth flow doesn't use it.

### 2. Verify the ID matches in Chrome

```
chrome://extensions  →  Developer mode  →  Load unpacked  →  apps/browser/dist (after first build)
```

The ID Chrome displays must match the one from the OpenSSL command. If it doesn't, the `key` field is wrong — fix the manifest before continuing.

### 3. Create the OAuth client in Google Cloud

1. **Google Cloud Console → Google Auth Platform → Clients → Create OAuth client ID**
2. **Application type: Chrome Extension** — *not* Web application. `chrome.identity.getAuthToken` validates against the extension ID, not a redirect URI.
3. **Application ID:** paste the 32-char Item ID from step 1.
4. **IMPORTANT: skip "Verify app ownership".** That section is *only* for extensions already published to the Chrome Web Store ("Once you have your Google Chrome Web Store extension created…"). For an unpacked dev extension with a pinned key, leave it blank — clicking Verify ownership will send you down a Web Store enrollment path you don't need.
5. Click **Create**. Google generates a client and offers a JSON download (e.g. `client_secret_79407...apps.googleusercontent.com.json`).

#### Handling the downloaded JSON

**IMPORTANT: do NOT commit the JSON to git.** Even though `chrome.identity.getAuthToken` does not use the embedded `client_secret` (the flow authenticates via the extension's signed key, not client-secret auth), Google treats that secret as a sensitive credential. Leaking it to a public repo will trigger Google's secret-scanning and force a rotation.

**Store the full JSON in 1Password as a Secured File** named e.g. `Google OAuth — Founder Navigator (Hackathon)` and share the 1Password item with hackathon teammates rather than emailing or Slacking the file. From the JSON you only need one value:

- `client_id` (the long `…apps.googleusercontent.com` string) — copy this into `apps/browser/manifest.json` `oauth2.client_id` *and* `bunx convex env set STARTUPSTATE_GOOGLE_CLIENT_ID <same-value>`. Both places must match — Convex verifies inbound Google ID tokens against this client ID.

Other fields in the JSON (`client_secret`, `project_id`, `auth_uri`, etc.) are **not** copied into the codebase.

### 4. Wire the Client ID into the extension

Add to `apps/browser/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Founder Navigator",
  "version": "0.0.1",
  "key": "<base64 public key from step 1>",
  "oauth2": {
    "client_id": "<client ID from step 3>",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  }
}
```

### 5. Enable the APIs and configure the consent screen

In the same Google Cloud project:

- **APIs & Services → Library:** enable **Gmail API** and **Google Drive API**.
- **Google Auth Platform → Branding:** fill in app name, support email, and a logo (judges will see this on the consent screen — make it look real).
- **Google Auth Platform → Audience:**
  - Keep the app in **Testing** mode (not Production). This avoids Google's CASA security review for the restricted Gmail / Drive scopes — fine for ≤ 100 test users.
  - **IMPORTANT: add every teammate's Google email + every judge's email as Test users.** Anyone not in this list will get an "access blocked: <App> has not completed the Google verification process" error and the OAuth flow will fail. This is the single most common demo-day failure mode for Chrome extensions using restricted Gmail / Drive scopes — verify the test-user list 30 minutes before judging.

### 6. Mirror the Client ID to Convex

Convex verifies the Google ID token server-side; the client ID must match.

```bash
bunx convex env set STARTUPSTATE_GOOGLE_CLIENT_ID <same-client-id-as-manifest>
```

---

## Convex backend env vars

```bash
bunx convex env set STARTUPSTATE_GOOGLE_CLIENT_ID <client-id-from-google-cloud>
bunx convex env set STARTUPSTATE_OPENAI_API_KEY <openai-key>
# OPENROUTER_API_KEY is already configured at the workspace level — no action needed.
```

If you skip the OpenAI key, resource embedding/matching will fail (AC-6 / AC-7). Inference (AC-5) uses the existing OpenRouter wrapper.

---

## Build & run

```bash
# From repo root
bun install

# Build the extension (watch mode for dev)
bun --filter @lotzoom/browser dev      # rebuilds on change
bun --filter @lotzoom/browser build    # one-shot production build → apps/browser/dist
```

Then load `apps/browser/dist` as an unpacked extension at `chrome://extensions`.

For backend changes:

```bash
bunx convex dev       # in another terminal — keep running while you develop
bun test:convex:once  # runs Vitest backend tests
```

### What `bun build` produces

The Vite + `@crxjs/vite-plugin` pipeline reads `manifest.json` as the entry manifest, walks every `oauth2`, `action`, `background`, and `content_scripts` reference, and emits a self-contained extension bundle in `apps/browser/dist`:

```
apps/browser/dist/
├── manifest.json                # rewritten with hashed asset paths
├── service-worker-loader.js     # crxjs SW shim that imports the chunked SW
├── src/popup/index.html         # popup entrypoint (loaded by chrome.action)
├── assets/
│   ├── index.html-*.js          # popup React bundle
│   ├── index.ts-*.js            # background SW + content-script chunks
│   ├── api-*.js                 # convex/_generated/api shared chunk
│   ├── storage-*.js             # shared lib chunk
│   └── index-*.css              # popup CSS
└── ...                          # source maps (`.map`) for debugging
```

`dist/manifest.json` is what Chrome actually reads. Don't hand-edit it — regenerate by running `bun --filter @lotzoom/browser build` after editing the source `manifest.json`.

### Pre-flight checks before sharing a build

Run these in order before handing the build to teammates or judges:

```bash
# 1. Lint + typecheck the extension
bunx biome check apps/browser
cd apps/browser && bunx --no -- tsc --noEmit && cd -

# 2. Backend tests must pass (the extension calls these actions)
bun test:convex:once convex/startupState/

# 3. Clean build
rm -rf apps/browser/dist
bun --filter @lotzoom/browser build

# 4. Sanity-check the manifest in dist/
cat apps/browser/dist/manifest.json | python3 -m json.tool | head -30

# 5. Load apps/browser/dist at chrome://extensions and confirm:
#    - The extension ID matches the one registered in Google Cloud
#    - "Connect Google" works end-to-end (popup shows your email)
#    - Visit startup.utah.gov and confirm the gap strip + badges render
```

### Versioning

Bump `apps/browser/manifest.json` `version` whenever you produce a build for distribution:

- **Hackathon iterations:** `0.0.1` → `0.0.2` → `0.0.3` (any monotonic increment is fine).
- **Pre-release / RC:** `0.1.0`, `0.2.0` for milestone drops.
- **Public Web Store:** `1.0.0` and onward; Chrome rejects re-uploads that don't strictly increment.

Manifest version syncs with `apps/browser/package.json` — keep them aligned by hand for now (small enough surface that codifying the lockstep isn't worth it).

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `chrome.identity.getAuthToken` returns "OAuth2 not granted or revoked" | Client ID in manifest doesn't match the Google Cloud OAuth client, OR the extension ID Chrome assigned doesn't match the one you registered. Re-verify steps 1–4. |
| OAuth screen shows "Access blocked: <App> has not completed the Google verification process" | The Google account you're testing with isn't in **Test users**. Add it under Google Auth Platform → Audience. |
| OAuth screen shows correct app name but the scopes look wrong | The consent screen caches the first scope set. Add `prompt: "consent"` to the auth call, or remove + re-add the OAuth grant at https://myaccount.google.com/permissions. |
| Extension ID changes when a teammate loads it | Their `manifest.json` is missing the `key` field, or the file got corrupted. Re-paste the public key. |
| Convex action returns "STARTUPSTATE_GOOGLE_CLIENT_ID is not set" | Run `bunx convex env set STARTUPSTATE_GOOGLE_CLIENT_ID <id>` and restart `convex dev`. |
| Gmail or Drive API returns 403 | API not enabled on the Cloud project (step 5), OR the user didn't grant that scope (the spec covers this in Error: OAuth scope denial). |

---

## Chrome Web Store submission

A submission to the Web Store is **not required for the hackathon demo** — judges can run the unpacked build. Submit only when shipping more broadly. Allow ~1–2 weeks of review for the first listing because of the restricted Gmail/Drive scopes (subsequent updates clear faster).

### Pre-submission checklist

- [ ] **Manifest hygiene.** `version` bumped, `description` ≤ 132 chars, `name` ≤ 45 chars, `permissions` and `host_permissions` are the minimum that work.
- [ ] **Icons.** Provide `icons` entries at 16, 32, 48, and 128 px in `apps/browser/public/icons/` and reference them in `manifest.json`. The 128 px icon is required and used as the Web Store listing image preview.
- [ ] **Screenshots.** 1280×800 or 640×400 PNGs, up to 5. Show the popup, the gap strip on `startup.utah.gov`, the side panel with citations, and one signal-source flow.
- [ ] **Promo tile** (optional but recommended): 440×280 small tile, 920×680 marquee.
- [ ] **Privacy policy URL.** Required for any extension that touches user data — host the policy at a stable URL (e.g. `https://startup.utah.gov/...` or a GitHub Pages page) and paste the URL into the Web Store listing.
- [ ] **Single-purpose justification.** Restricted scopes (`gmail.readonly`, `drive.readonly`) require a single-purpose statement and a short narrative explaining *why* each scope is needed. Use the spec's "Why" section as the source of truth.
- [ ] **Demo video** (recommended): Loom / YouTube unlisted, ≤ 60 seconds. Walk through `Connect Google → ingest → visit startup.utah.gov`. Pasted into the listing description, this dramatically reduces back-and-forth with the reviewer.
- [ ] **Test users widened.** Before going **Production** in Google Auth Platform → Audience, the consent screen must pass Google's CASA review for the restricted scopes — see "Going to production" below. Until then, the listing is publishable but only test users can actually sign in.

### Producing the upload artifact

Chrome Web Store accepts a `.zip` of the unpacked extension. **Do not include the source folder, `node_modules`, source maps, or `key.pem`.**

```bash
# From repo root
rm -rf apps/browser/dist
bun --filter @lotzoom/browser build

# Strip source maps from the upload (they're useful locally; not for the store)
find apps/browser/dist -name "*.map" -delete

# Zip from inside dist/ so paths inside the archive are flat
cd apps/browser/dist
zip -r "../founder-navigator-$(date +%Y%m%d).zip" .
cd -

# Verify: the archive should be < 5 MB and contain manifest.json at the root
unzip -l apps/browser/founder-navigator-*.zip | head
```

> **NEVER ship a build that includes `key.pem`.** Confirm with `unzip -l ... | grep key.pem` (output should be empty).

### Submitting to the Chrome Developer Dashboard

1. Sign in to https://chrome.google.com/webstore/devconsole/ with the **publishing account** (one-time $5 dev fee). Use a project-owned Google account, not a personal one — the listing follows the account.
2. **New item** → upload the `.zip`.
3. Fill in the **Store listing** tab:
   - Detailed description (paste the spec's "Why" + key user benefits, not implementation detail).
   - Category: *Productivity* (alternative: *Tools*).
   - Language: English.
   - Screenshots, promo tiles, icon — all from the pre-submission checklist.
4. Fill in the **Privacy practices** tab:
   - **Single-purpose statement:** "Personalize startup.utah.gov for Utah founders by reading their existing Gmail / Drive / local docs and overlaying relevance and gap signals on the live site."
   - **Permissions justifications:** one short paragraph per permission (`identity`, `storage`, `host_permissions[startup.utah.gov]`, `host_permissions[gmail.googleapis.com]`, `host_permissions[www.googleapis.com]`).
   - **OAuth scope justifications:**
     - `userinfo.email` — "Establish founder identity in our backend; no email sending."
     - `gmail.readonly` — "Read recent message subjects and bodies (last 90 days, founder-initiated only) to infer business stage, industry, and unmet lifecycle steps. Read-only; no archives, no labels modified, no messages sent."
     - `drive.readonly` — "Read text-extractable files in a folder the founder explicitly picks. Read-only; no folders/files outside the picked one are accessed; no writes."
   - **Data usage:** declare collection of email content + Drive content + arbitrary local file content. Mark **not sold to third parties**, **not used for purposes unrelated to the single purpose**, **not used to determine creditworthiness**.
   - Privacy policy URL.
5. Fill in the **Distribution** tab:
   - Visibility: **Private** (until Production-ready) or **Unlisted** (link-only sharing during the demo period).
   - Distribution: visible to specified emails initially.
6. **Submit for review.**

### Going to production (post-hackathon)

The OAuth consent screen must move from **Testing** to **Production** before the listing can be Public. Restricted scopes (`gmail.readonly`, `drive.readonly`) trigger Google's CASA security assessment:

1. **Verify domain ownership** in Google Cloud Console (the support email's domain).
2. **Submit a video demo** showing each restricted scope being requested and explaining the user-visible value.
3. **Apply for the security assessment** via the Google Auth Platform → Audience → Production flow. CASA Tier 2 is required for `gmail.readonly`; Tier 1 for `drive.readonly` if scoped to a single picked folder.
4. **Independent third-party CASA assessment** by an authorized auditor — typical cost $5k–$15k, timeline 4–8 weeks.

Until CASA passes, keep the consent screen in **Testing** mode and add specific judges / testers to **Test users** (≤ 100). The Web Store listing can still be Private/Unlisted in this state — only the OAuth flow gates the user count.

### Updating an existing listing

For each subsequent release:

1. Bump `apps/browser/manifest.json` `version` (must strictly increase).
2. Re-run the pre-submission checklist + zip step above.
3. Web Store Dashboard → **Package** tab → **Upload new package**.
4. Add release notes in **Store listing**.
5. Submit. Updates that don't change permissions typically clear review in hours; permission changes re-trigger the full review.

### Distribution alternatives (if you skip the Web Store)

- **Direct unpacked sharing** — works for any teammate or judge with Developer Mode access. The simplest path during the hackathon.
- **`.crx` + `update_url`** — Chrome will install a self-hosted `.crx` only via Group Policy on managed devices. Not worth the setup unless you're shipping inside an org.
- **Edge Add-ons store** — Chromium-based but a separate listing. Out of scope for v1.

---

## Sharing with hackathon teammates

When onboarding a teammate:

1. They clone the repo, install (`bun install`).
2. They do **not** regenerate the keypair — the public key is already committed in `manifest.json`. Their unpacked extension will have the same ID as everyone else's.
3. They get added as a Test user in Google Cloud → Audience (one of the admins of the OAuth client adds them).
4. They run `bun --filter @lotzoom/browser dev` and load `apps/browser/dist` unpacked in Chrome. OAuth works immediately.

If a teammate accidentally regenerates `key.pem`, **the extension ID changes for them and OAuth breaks**. Recovery: discard their `key.pem`, pull the committed `manifest.json`, reload the extension.

---

## What this extension is NOT

- Not Lotzoom auth — the hackathon namespace is isolated from the production Lotzoom user space.
- Not multi-browser — Chrome only. Firefox / Safari / Edge are out of scope for v1.
- Not a long-form interview UI — explicit anti-goal. If you find yourself adding a form, stop and re-read the spec's Why.
- Not the Utah Startup Map (Hackathon Part 2) — separate spec, see `vault/todos/startupstate/utah-startup-map.md`.
