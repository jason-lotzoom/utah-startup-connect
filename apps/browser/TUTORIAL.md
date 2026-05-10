# Founder Navigator — User Tutorial

A 5-minute walkthrough of the **Startup.Utah.gov 5.io Navigator** Chrome extension. By the end you'll have a personalized version of `startup.utah.gov` showing only the programs that match your business stage, industry, and gaps.

> **Reading time:** ~3 minutes. **Hands-on time:** ~5 minutes.

---

## What this extension does

`startup.utah.gov` lists hundreds of programs across four lifecycle stages — grants, mentors, incubators, accelerators, training, etc. Without help, finding the right one means scrolling, searching, and filling out long forms. This extension reads what you already have (recent emails, a Drive folder, a local docs folder) and personalizes the page in three ways:

1. **Top-of-page gap-analysis strip** — the lifecycle steps you haven't covered yet, with direct links to the right programs.
2. **Relevance badges on resource cards** — `Top match`, `Strong match`, or `Maybe`, computed from your business signals.
3. **Side panel on hover** — quotes the actual email or document of yours that triggered the match, so you know *why* the program is relevant.

Nothing is ever written back to your Gmail or Drive. All data is read-only.

---

## Step 1 · Install the extension

You'll get the extension as either:

- **An unpacked folder** (`apps/browser/dist/`) — you'll load this directly into Chrome.
- **A `.zip` from the Chrome Web Store** *(once published)* — install with one click.

### Loading the unpacked folder (hackathon / pre-store)

1. Open Chrome and visit `chrome://extensions`.
2. In the top-right, toggle **Developer mode** on.
3. Click **Load unpacked**.
4. Select the `apps/browser/dist` folder you were given.
5. The extension's icon (a star/lightning bolt placeholder until we ship art) appears in the toolbar.

> **Pin the icon.** Click the puzzle-piece icon in Chrome's toolbar, then click the pushpin next to "Startup.Utah.gov 5.io Navigator". This keeps the icon visible.

### From the Chrome Web Store *(when available)*

1. Open the listing page.
2. Click **Add to Chrome → Add extension**.
3. Pin it as above.

---

## Step 2 · Connect Google

1. **Click the extension icon** in your Chrome toolbar. The popup opens.
2. Click **Connect Google**.
3. A standard Google OAuth dialog appears, asking you to:
   - Confirm your email address.
   - Grant **read-only** access to Gmail.
   - Grant **read-only** access to Drive.
4. Click **Continue** / **Allow**.
5. The popup updates to show your email + three new rows: **Gmail**, **Drive folder**, **Local folder**.

> ⚠️ **If you see "Access blocked: This app hasn't been verified"** during the hackathon period, your email isn't on the test-user list yet. Ping the project owner with your Google email; they'll add you (it takes ~30 seconds) and you can retry.

---

## Step 3 · Connect signal sources

You can connect any 1–3 sources. More sources = better personalization, but **3 is enough** to get a profile.

### Gmail (last 90 days)

1. In the popup, click **Sweep** next to **Gmail**.
2. The status pill cycles `Ingesting…` → `Ingested 247 (3 dup, 1 skip)` (your numbers will differ).
3. The sweep is read-only — your inbox is untouched. We pull subject lines + body text from text-based messages and ignore promotional bulk mail when we can.

### Google Drive folder

1. Click **Pick folder** next to **Drive folder**.
2. A prompt asks for the folder URL or ID. The easiest way:
   - Open Google Drive in another tab.
   - Right-click the folder you want to share *(your business / startup folder)*.
   - **Get link** → copy the URL → paste into the prompt.
3. The status pill cycles to `Ingested 18 files (3 skipped)`. Skipped files are unsupported formats (images, audio, etc.) — that's expected.

### Local folder *(Chrome's File System Access API)*

1. Click **Pick folder** next to **Local folder**.
2. Chrome opens its native folder picker.
3. Choose a folder on your computer with notes, plans, drafts, contracts, etc.
4. Click **View** when prompted *(this grants the extension read-only access for this session only)*.
5. The status pill shows `Ingested 11 files`.

> **Privacy:** Local folder access is *per-session*. Closing Chrome revokes the permission. The extension never copies your files anywhere except sending the extracted text to the Convex backend that powers your profile.

---

## Step 4 · Build your profile

1. Once you've ingested at least **3 signals total** (across any combination of sources), click **Build / refresh profile**.
2. The button shows `Inferring profile…` for ~5–10 seconds.
3. Below it, your inferred profile chips appear:
   - **Stage:** `pre-incorporation`, `incorporated`, `early-revenue`, etc.
   - **Geography:** if your signals mention a Utah city / county / region.
   - **Industries:** 1–4 short tags.
   - **Gaps:** 1–5 things missing from your toolkit (e.g. `no co-founder`, `no first hire`, `no IP filing`).

You can re-run the inference anytime — each run produces a new profile *version*. The latest version is always what powers the on-site augmentation.

---

## Step 5 · Visit startup.utah.gov

1. In a new tab, go to https://startup.utah.gov/.
2. Within ~3 seconds, you'll see:
   - **A blue strip across the top** listing your unmet lifecycle steps with direct links to the relevant programs.
   - **Badges next to resource cards** — `Top match` (green), `Strong match` (blue), `Maybe` (yellow).
3. **Hover over any badged card.** A side panel slides in from the right showing:
   - The program title.
   - 1–3 short quotes from *your own* emails / documents that triggered the match.
   - The source of each quote (Gmail, Drive, or Local folder).
4. Click the resource link as you normally would. The site is otherwise untouched — no forms get auto-filled, no clicks are intercepted, no popups.

---

## What if you don't see any badges?

A few common reasons:

| Symptom | Cause | Fix |
|---|---|---|
| Top strip says "Connect your business signals…" | Profile not yet built. | Open the popup, sweep Gmail / pick a Drive folder / pick a local folder, then click **Build / refresh profile**. |
| No badges anywhere on the page | Profile was built but no card matches. Common when Gmail is sparse and you only connected Gmail. | Connect a Drive folder or local folder with more business context; re-run **Build / refresh profile**. |
| Badges flash and disappear | The site re-rendered between mounts. Refresh the page. | `Cmd+R` / `Ctrl+R`. |
| OAuth says "scope already granted" but features don't work | Granted scopes drifted from the manifest. | Open `https://myaccount.google.com/permissions`, find "Startup.Utah.gov 5.io Navigator", remove access, click **Connect Google** in the popup again. |

---

## What gets sent off your machine?

| Source | What we read | What we send to the backend | What we never touch |
|---|---|---|---|
| Gmail | Subject + plain-text body of the last 90 days of messages (read-only). | Subject + body excerpt + sender. | Attachments, archived mail, sent mail beyond 90 days, contacts, labels. |
| Drive | Files in **only the folder you pick**. Google Docs are exported as plain text; PDFs are text-extracted; plaintext / markdown / CSV are read directly. | Filename + extracted text. | Files outside the picked folder, file content beyond the first ~12,000 characters, owners / sharing settings, comments. |
| Local folder | Files in **only the folder you pick** in Chrome's picker, **only this browser session**. | Filename + extracted text. | Files outside the picked folder, binary files (images / audio / video), the folder path. |

Everything is sent over HTTPS to a Convex backend in your account scope. No third party (other than Google for the OAuth verification) sees the data.

---

## Removing the extension / your data

- **Disable for one site:** Right-click the extension icon → **Manage** → toggle off `startup.utah.gov`.
- **Uninstall:** `chrome://extensions` → **Remove**.
- **Revoke Google access:** https://myaccount.google.com/permissions → find the app → **Remove access**.
- **Delete your founder profile + ingested signals:** message the project team during the hackathon (we'll wire up self-service deletion in a later release).

---

## Quick reference

| Action | How |
|---|---|
| Open the popup | Click the extension icon (or pin via the puzzle menu) |
| Connect Google | **Connect Google** button in the popup |
| Ingest Gmail | Popup → **Sweep** next to Gmail |
| Ingest Drive | Popup → **Pick folder** next to Drive → paste folder URL |
| Ingest local folder | Popup → **Pick folder** next to Local folder → choose in OS picker |
| Build profile | Popup → **Build / refresh profile** |
| See augmentation | Visit https://startup.utah.gov/ |
| Reset | `chrome://extensions` → **Remove** + revoke at `myaccount.google.com/permissions` |

That's it. Happy founding.
