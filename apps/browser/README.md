# Founder Navigator — Chrome Extension

A Manifest V3 Chrome extension that personalizes [startup.utah.gov](https://startup.utah.gov/) for Utah founders. Built for the Utah GOED Builder Day hackathon (Part 1: Founder's Navigator).

The extension reads ambient signals from a founder's Gmail, Google Drive, and a local business-docs folder, infers their stage / industry / geography / gaps via the Convex backend, and overlays the live `startup.utah.gov` site with relevance-ranked badges, a gap-analysis strip, and contextual side-panel citations from the founder's own artifacts.

Spec: `vault/specs/draft/founder-navigator-startup-utah-extension/spec.md`

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
bunx convex env set OPENAI_API_KEY <openai-key>
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
