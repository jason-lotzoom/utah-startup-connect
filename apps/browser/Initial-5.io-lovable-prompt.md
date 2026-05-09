# 5iO — Full Lovable Build Prompt
### Utah Governor's Office of Economic Development · AI Builder Day Hackathon

> **Before pasting this into Lovable:**
> 1. Upload your Pinterest design references first so Lovable can match the visual style
> 2. Add your Mapbox token in Lovable's environment variables as `VITE_MAPBOX_TOKEN` (free at mapbox.com)

---

## OVERVIEW

Build a full-stack web application called **5iO** — a dual-product platform for Utah's startup ecosystem, built for the Utah Governor's Office of Economic Development. The platform has two interconnected tools that live together under one unified app, navigation, and design system.

---

## DESIGN SYSTEM

**Brand Name:** 5iO

**Aesthetic:** Utah-inspired. Think Arches National Park, Zion Canyon, red rock formations, wide desert skies, and the Wasatch mountain range. This should feel like a premium, modern government-tech product — not a generic startup tool, not a typical .gov site.

**Color Palette:**
- Primary: `#C1440E` — Canyon Red / burnt terracotta
- Secondary: `#E8A87C` — Sandstone / warm peach
- Accent: `#2E86AB` — Desert Sky Blue
- Dark BG: `#1A1A2E` — Deep night sky
- Surface: `#F5F0E8` — Warm off-white / parchment
- Text Dark: `#1C1C1C`
- Text Light: `#F5F0E8`
- Success: `#4CAF50`
- Muted: `#8A8A8A`

**Typography:**
- Headings: `Playfair Display` (Google Font) — editorial, strong
- Body: `Inter` (Google Font) — clean, readable
- Accent labels/tags: `Space Grotesk` — uppercase with letter-spacing

**Visual Motifs:**
- Subtle mountain silhouette SVG as a decorative divider between sections
- Arched UI elements (card tops, modal headers) referencing Utah's famous arches
- Gradient hero backgrounds: deep canyon red fading to dark navy
- Map elements use a warm dark Mapbox style

**Spacing:** Generous whitespace, card-based layouts, smooth rounded corners (12–16px radius)

**Motion:** Subtle fade-in on scroll, smooth route transitions

---

## TECH STACK

| Layer | Choice |
|---|---|
| Framework | React + TypeScript (Lovable default) |
| Database | Supabase (Lovable built-in) |
| Auth | Supabase Auth — Email/Password |
| AI | Gemini API (Lovable built-in integration) |
| Map | Mapbox GL JS via `react-map-gl` |
| Styling | Tailwind CSS + shadcn/ui |
| Icons | Lucide React |

---

## DATABASE SCHEMA

Create the following Supabase tables:

### `resources`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| title | text | |
| description | text | |
| communities | text[] | Any, Women, Veteran, Rural, Student, Multicultural, New American |
| industries | text[] | Software and IT, Life Sciences, Aerospace, Manufacturing, Agriculture, Financial Services, CPG, Arts, Hospitality, Other |
| locations | text[] | Utah county names |
| topics | text[] | Start a Business, Funding, Marketing and Sales, Taxes and Finance, International Trade, Late Stage Growth, Entrepreneurship Communities, Relocate a Business to Utah, Close or Exit a Business, Other |
| link | text | |
| email | text | nullable |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

### `companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| name | text | |
| description | text | |
| website | text | |
| linkedin_url | text | |
| full_address | text | |
| latitude | float | |
| longitude | float | |
| sector | text | B2B Software, Bio/Medical Tech, FinTech, Security, Consumer, Energy, Marketplaces |
| stage | text | Pre-Seed, Seed, Series A, Series B, Series C, Series D+, Bootstrapped |
| employee_count | text | |
| year_founded | integer | nullable |
| hiring_status | boolean | default false |
| logo_url | text | nullable |
| photos | text[] | nullable |
| is_verified | boolean | default false |
| is_claimed | boolean | default false |
| claimed_by | uuid | references auth.users, nullable |
| submitted_by | uuid | references auth.users, nullable |
| status | text | active, pending_review, rejected |
| created_at | timestamp | |
| updated_at | timestamp | |

### `job_postings`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| company_id | uuid | references companies |
| title | text | |
| description | text | |
| location | text | |
| type | text | Full-time, Part-time, Contract, Remote |
| url | text | nullable |
| is_active | boolean | default true |
| ai_imported | boolean | default false |
| created_at | timestamp | |

### `claim_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| company_id | uuid | references companies |
| user_id | uuid | references auth.users |
| email | text | |
| message | text | nullable |
| status | text | pending, approved, rejected |
| created_at | timestamp | |

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | references auth.users, primary key |
| full_name | text | |
| email | text | |
| role | text | founder, investor, admin |
| company_id | uuid | nullable |
| created_at | timestamp | |

### `navigator_sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| session_data | jsonb | |
| recommendations | jsonb | |
| created_at | timestamp | |

---

## SEED DATA

Seed the `resources` table with 213 resources. Each resource has the following fields: id, title, description, communities (pipe-separated → array), industries (pipe-separated → array), locations (pipe-separated → array), topics (pipe-separated → array), link, email.

Seed the `companies` table with 222 companies from the map dataset. Each has: display_type, linkedin_url, name, full_address, description, website, stage, employee_count, sector. Geocode addresses to lat/lng using approximate Utah coordinates based on city name. Mark all seeded companies as `is_verified: true`, `status: 'active'`.

---

## APP STRUCTURE & ROUTING

```
/                       → Landing page
/navigator              → Founder's Navigator (Part 1)
/map                    → Utah Startup Map (Part 2)
/map/company/:id        → Company profile page
/map/add-company        → Submit new company form
/map/claim/:id          → Claim existing company
/auth/login             → Login
/auth/signup            → Sign up
/auth/forgot-password   → Password reset
/dashboard              → Logged-in user dashboard
/admin                  → Admin panel (admin role only)
```

---

## NAVIGATION

Sticky top navbar:
- **Left:** "5iO" wordmark with small arch icon
- **Center (desktop):** Navigator | Startup Map | Add Company
- **Right:** Login / Sign Up (logged out) OR Dashboard + Avatar (logged in)
- **Mobile:** Hamburger menu
- **On scroll:** Navbar gains frosted glass background with backdrop blur

---

## LANDING PAGE `/`

### Hero Section
- Full viewport, gradient background: canyon red → deep navy
- Large mountain silhouette SVG at bottom of hero (decorative, layered)
- Headline: **"Build the Startup State."** (Playfair Display, 72px, white)
- Subline: "Two tools. One platform. Built for Utah founders." (Inter, 20px, sandstone)
- Two CTA buttons side by side:
    - "Find Resources →" (filled, canyon red)
    - "Explore the Map →" (outlined, white)

### Two Products Section
- Side-by-side cards on desktop, stacked on mobile
- **Card 1 — The Founder's Navigator:** Icon, description, "Get Started →"
- **Card 2 — The Utah Startup Map:** Icon, description, "Explore Map →"

### By the Numbers Section
- Animated counters on scroll:
    - 213 Resources
    - 222 Startups
    - 29 Counties
    - 7 Sectors

### Persona Carousel Section
Show the 6 test case personas from the hackathon brief as swipeable cards. Each card includes name, age, city, situation summary, and a **"See what 5iO finds →"** button that pre-fills the navigator quiz with their profile.

| # | Name | Age | Location | Situation |
|---|---|---|---|---|
| 1 | Jordan | 20 | Salt Lake City | Pre-seed, first idea, no business yet |
| 2 | Maria | 38 | Washington County | Small agricultural operation, rural, woman-owned |
| 3 | Marcus | 34 | Ogden | Veteran, starting custom fabrication/manufacturing |
| 4 | Priya | 31 | Salt Lake City | B2B SaaS, 18 months in, ready to raise |
| 5 | David | 45 | Provo | Medical device, 12 employees, FDA cleared, going international |
| 6 | Dr. Amir | 29 | Salt Lake City | PhD candidate, commercializing university research |

### Footer
- 5iO logo + tagline
- Links: Navigator | Startup Map | Add Your Company | Admin
- "Presented by Utah Governor's Office of Economic Development · startup.utah.gov"

---

## PART 1 — THE FOUNDER'S NAVIGATOR `/navigator`

An AI-powered resource discovery tool. A founder should go from zero context to a personalized list of the right state programs in under 2 minutes. Use a **hybrid UX**: guided quiz first → AI chat + smart filters to refine.

### Quiz Flow (Step-by-Step, Full Screen)

Show one question at a time with large tappable option cards. Progress bar at top. Animated transitions between steps. Quiz state persists in `localStorage` on refresh.

**Question 1 — Stage:**
> "Where are you in your journey?"
- Just an idea
- Early stage (pre-revenue)
- Growing (paying customers)
- Established (scaling/hiring)
- Mature business

**Question 2 — Industry:**
> "What's your primary industry?"
Show all 10 industries as icon cards:
Aerospace and Defense | Agriculture | Arts and Entertainment | Consumer Packaged Goods | Financial Services | Hospitality and Food Services | Life Sciences and Healthcare | Manufacturing | Software and IT | Other

**Question 3 — Location:**
> "Where are you located?"
Utah county dropdown + "Anywhere in Utah" option

**Question 4 — Identity (multi-select):**
> "Which of these describes you?"
- Women-owned
- Veteran-owned
- Rural business
- Student / University
- Multicultural
- New American
- None of these

**Question 5 — Need (multi-select):**
> "What do you need most right now?"
- Funding
- Start a business
- Marketing & Sales
- Find mentors
- International expansion
- Taxes & Finance
- Grow my team
- Exit / Close

**After Question 5:**
Show a 2-second loading screen: "Finding your resources..." with animated Utah mountain silhouette, then transition to results.

---

### Results Page Layout

**Two columns on desktop, single column on mobile.**

**Left Panel (sticky):**
- Profile summary card: "Based on your profile..." showing answers as styled tags
- AI Chat interface (collapsible on mobile) — see AI Integration section
- Filter chips: Topic | Industry | Community | Location — clicking refines results instantly

**Right Panel:**
- Headline: "X resources matched for you"
- Resource cards grid, sorted by AI relevance score
- Each card:
    - Left border color-coded by topic
    - Title (bold, Playfair Display)
    - 2-line truncated description
    - Topic pill + community pills
    - "Visit Resource →" button + email icon (if email exists)
    - Hover: subtle lift + canyon red border

---

### AI Chat (Gemini) — Navigator

**System Prompt:**
```
You are a helpful guide for Utah entrepreneurs. You have access to a database of 213 state resources including funding programs, mentorship, training, and support services. Based on the founder's profile and their questions, help them find the most relevant programs. Always be specific, encouraging, and reference actual program names. Keep responses concise and actionable.
```

- First AI message is pre-filled: *"Hi! I've found [X] resources that match your profile. Ask me anything — like 'what funding is available for veterans?' or 'I need help with my first business plan.'"*
- On user message: call Gemini with system prompt + founder profile context + full resource list + user message
- Stream responses in real-time
- Below each AI response: show 2–3 "Suggested Resources" pulled from matched results

---

## PART 2 — THE UTAH STARTUP MAP `/map`

### Hero Section (Above Map)
- Headline: **"Utah's Startup Ecosystem"** (Playfair Display)
- Subtext: "222+ companies building the future in Utah"
- Stats bar: Total Companies | Sectors | Hiring Now | Funding Stages

### Mapbox Map Component
- Full-width, `height: 60vh` desktop / `50vh` mobile
- Style: `mapbox://styles/mapbox/dark-v11`
- Initial center: `[-111.7, 39.3]` (center of Utah), zoom: `6.5`
- Custom SVG circle markers colored by sector:

| Sector | Color |
|---|---|
| B2B Software | `#2E86AB` |
| Bio/Medical Tech | `#4CAF50` |
| FinTech | `#F4A261` |
| Security | `#C1440E` |
| Consumer | `#9B5DE5` |
| Energy | `#FFD166` |
| Marketplaces | `#06D6A0` |

- Clustering enabled below zoom level 10 — click cluster to zoom in
- Click single pin → show popup: company name, sector badge, employee count, "View Profile →" button
- Animate camera to clicked company

### Filter Bar
- Horizontal scrollable pill filters on mobile
- Filters: Sector (multi-select) | Stage (multi-select) | Hiring (toggle) | Employees (1–10, 11–50, 51–200, 200+)
- Active filter count badge + "Clear All" button
- Filters update map pins AND company grid in real-time

### Company Grid (Below Map)
- 3 cols desktop | 2 cols tablet | 1 col mobile
- Each card: Logo/avatar | Name | Sector badge | Stage badge | Location | Short description | "Hiring" green badge | "View Profile →"
- 20 per page with pagination or infinite scroll

---

## COMPANY PROFILE PAGE `/map/company/:id`

### Hero
Company name (Playfair Display, large) | Sector + Stage badges | Website link | LinkedIn link | "Hiring" badge if applicable

### Content Grid (2 columns)

**Left:**
- Full description
- Photo gallery (horizontal scroll)
- Job Postings section

**Right Sidebar Card:**
- Website
- LinkedIn
- Address + small embedded Mapbox mini-map
- Year Founded
- Employees
- Stage
- Sector
- "Claim this profile" button (if unclaimed)
- "Edit profile" button (if owner)

### Job Postings Section
- List: Title | Type badge | Location | "Apply →" button
- If none: "No open positions right now"
- If owner: "+ Add Job Posting" button

---

## ADD COMPANY `/map/add-company`

Multi-step form for new company submissions.

### Step 1 — Basic Info
Name | Website | LinkedIn URL | Full Address | Sector (dropdown) | Stage (dropdown) | Employee Count | Year Founded | Description

### Step 2 — AI Job Import
- Textarea: "Paste your LinkedIn company page URL or any job board URL"
- **"Import Jobs with AI"** button

**Gemini Prompt for Job Import:**
```
Extract all job postings from the following content. Return a JSON array with fields: title, description, location, type (Full-time / Part-time / Contract / Remote), url. Content: [pasted content]
```

- Show extracted jobs as editable cards — user can remove or edit before saving
- Also allow manual "+ Add Job" button

### Step 3 — Hiring & Media
- Toggle: "Currently Hiring?"
- Upload photos (up to 5)
- Logo upload

### Step 4 — Verification
- Email field: "Enter your business email to verify ownership"
- Checkbox: "I confirm this is a real Utah startup and I have authority to list it"
- Submit → `status: 'pending_review'`
- **Success Screen:** "Your listing has been submitted! Our team will review and approve within 24 hours."

---

## CLAIM COMPANY `/map/claim/:id`

For claiming an existing unclaimed company from the dataset.

- Show existing company card
- Form: Full Name | Business Email (must match company website domain) | Role at company | Message (optional)
- Submit → creates `claim_request` with `status: 'pending'`
- Show: "Claim request submitted. We'll verify and grant you access within 24 hours."

---

## DASHBOARD `/dashboard`

**If user has a claimed/created company:**
- Company profile summary card with "Edit" button
- Edit all fields inline
- Manage job postings: list with edit/delete + add new
- **AI Job Import** button (same flow as Step 2 above)
- Stats: Profile views (placeholder) | Jobs posted | Listing status

**If user has no company:**
- "Add your startup to the map" CTA → `/map/add-company`
- "Claim an existing listing" CTA → `/map` with search

---

## ADMIN PANEL `/admin`

Role-protected — only accessible by users with `role = 'admin'` in the `profiles` table.

### Resources Tab
- Full table of all 213 resources
- Columns: Title | Topics | Industries | Communities | Link | Status
- Actions: Edit (inline drawer) | Toggle active | Delete
- "+ Add Resource" button with full form (all fields, multi-select for arrays)
- Search and filter bar

### Companies Tab
- Table with status filter: Active | Pending Review | Rejected
- Pending tab: shows new submissions and claim requests with Approve / Reject buttons
- Edit any company inline
- View profile button

### Users Tab
- List all users
- Change role: founder / admin
- See which company they're linked to

---

## AUTH PAGES

### `/auth/login`
- Centered card on warm parchment background
- Utah mountain graphic above form
- Email + Password fields
- "Forgot password?" link
- "Sign in" button (canyon red)
- "New to 5iO? Create an account" link

### `/auth/signup`
- Same card layout
- Fields: Full Name | Email | Password | Confirm Password | I am a: (Founder / Investor / Other)
- On submit: create Supabase auth user + insert into `profiles` table
- Redirect to `/dashboard`

### `/auth/forgot-password`
- Email field + "Send reset link" button
- Supabase password reset flow

---

## AI INTEGRATION SUMMARY

Use Gemini in three places:

### 1. Navigator Recommendations (after quiz)
Send founder profile to Gemini with full resources list. Ask it to return the **top 10 most relevant resource IDs**, ranked by relevance, with a one-sentence reason for each. Display these at the top of results with an "AI Recommended" badge.

### 2. Navigator Chat (ongoing)
Conversational Gemini session using founder profile + full resources as context. Stream responses. Show suggested resource cards below each AI reply.

### 3. Job Import (Add Company / Dashboard)
Given pasted URL or text content, extract structured job postings as a JSON array. Parse and display as editable cards before saving to DB. Flag imported jobs with `ai_imported: true`.

---

## MAPBOX SETUP

- Library: `react-map-gl` (Vite compatible)
- Token env var: `VITE_MAPBOX_TOKEN`
- Initial view: center `[-111.7, 39.3]`, zoom `6.5`
- Clustering below zoom level 10
- Custom sector-colored SVG circle markers
- Zoom controls + fullscreen button
- Mini-map on company profile page (zoom `13`, non-interactive)

---

## RESPONSIVE DESIGN

| Breakpoint | Layout |
|---|---|
| Mobile < 768px | Single column, bottom sheet modals, horizontal scroll filters |
| Tablet 768–1024px | 2-column grid |
| Desktop > 1024px | Full multi-column layouts as described |

---

## EMPTY STATES & LOADING

- All data fetching: **skeleton loaders** (pulsing gray card placeholders)
- Empty search/filter results: Illustrated empty state + "No resources matched. Try adjusting your filters." + Reset button
- Map with no results: "No companies match your filters" overlay centered on map

---

## SUPABASE RLS POLICIES

- `resources` and `companies`: **publicly readable** (no auth required)
- Write operations: **require authentication** (except new company submissions — allow anonymous with rate limiting)
- Admin routes: redirect to `/auth/login` if unauthenticated; redirect to `/` if authenticated but not admin role

---

## MISC IMPLEMENTATION NOTES

- Navigator quiz state persists in `localStorage` — refreshing the page does not reset progress
- Pre-seed the database with all 213 resources and 222 companies on first deploy via a seed script or Supabase migration
- All 222 seeded companies: `is_verified: true`, `status: 'active'`
- Geocode city/address to lat/lng using approximate Utah city coordinates for the map seed data

---

*Built for the Utah Governor's Office of Economic Development · AI Builder Day Hackathon*
*5iO — Find your resources. See what's being built. Build the Startup State.*
