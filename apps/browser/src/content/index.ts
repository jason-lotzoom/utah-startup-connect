/**
 * Content script — mounts the founder-navigator overlay on
 * `startup.utah.gov`. Three augmentations:
 *   1. Top-of-page gap-analysis strip (data-startupstate-gap-strip)
 *   2. Per-card relevance badges    (data-startupstate-badge)
 *   3. Per-card hover flyout with WHY / BENEFIT / CTA (data-startupstate-flyout)
 *
 * The script is non-destructive: every injected node carries a
 * `data-startupstate-*` attribute and is removed on extension disable.
 *
 * Glass effect: pure CSS `backdrop-filter: blur(28px) saturate(180%)` —
 * Apple's UIKit-material recipe, supported in Chrome 76+ (this is a
 * Chrome-only extension), and adds zero JS bytes vs. importing a library.
 */

import { ConvexClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { readCachedSnapshot, writeCachedSnapshot } from "../lib/snapshot";
import { StorageKeys } from "../lib/storage";

declare const __CONVEX_URL__: string;

interface IdentityMessage {
	googleSub?: string;
	email?: string;
	founderId?: string;
}

type ResourceMatch = FunctionReturnType<typeof api.startupState.resources.matchResources>[number];

const STYLE_ID = "startupstate-styles";

const STYLE_CSS = `
[data-startupstate-gap-strip] {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 2147483646;
	background: linear-gradient(135deg, #10232a, #ca9538);
	color: white;
	padding: 10px 16px;
	font: 600 14px/1.4 -apple-system, system-ui, sans-serif;
	display: flex;
	gap: 12px;
	align-items: center;
	flex-wrap: wrap;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}
[data-startupstate-gap-strip] .brand-icon {
	width: 26px;
	height: 26px;
	border-radius: 6px;
	flex-shrink: 0;
	display: block;
}
[data-startupstate-gap-strip] .gap-strip-label {
	white-space: nowrap;
	flex-shrink: 0;
}
[data-startupstate-gap-strip] .gap-link {
	background: rgba(255,255,255,0.15);
	color: #ffffff;
	padding: 4px 10px;
	border-radius: 999px;
	text-decoration: none;
	font-size: 12px;
	white-space: nowrap;
	flex-shrink: 0;
	transition: color 0.15s ease, background 0.15s ease;
}
[data-startupstate-gap-strip] .gap-link:hover {
	color: #0edf81;
	background: rgba(225,225,225,0.14);
}
[data-startupstate-gap-strip] .gap-link [data-startupstate-badge] {
	white-space: nowrap;
}
[data-startupstate-badge] {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 999px;
	font: 600 11px/1.2 -apple-system, system-ui, sans-serif;
	margin-left: 6px;
}
[data-startupstate-badge="top"] { background: #dcfce7; color: #166534; }
[data-startupstate-badge="strong"] { background: #dbeafe; color: #1e40af; }
[data-startupstate-badge="maybe"] { background: #fef3c7; color: #92400e; }

[data-startupstate-flyout] {
	position: fixed;
	z-index: 2147483647;
	width: 320px;
	max-height: 70vh;
	overflow-y: auto;
	padding: 14px 16px 16px;
	background: rgba(255, 255, 255, 0.57);
	backdrop-filter: blur(24px) saturate(180%);
	-webkit-backdrop-filter: blur(24px) saturate(180%);
	border: 1px solid rgba(255, 255, 255, 0.55);
	border-radius: 16px;
	box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18), 0 1px 3px rgba(15, 23, 42, 0.08);
	font: 13px/1.5 -apple-system, system-ui, sans-serif;
	color: #0f172a;
	opacity: 0;
	transform: translateY(-8px);
	transition: opacity 0.18s ease, transform 0.18s ease;
	pointer-events: none;
}
[data-startupstate-flyout][data-visible="true"] {
	opacity: 1;
	transform: translateY(0);
	pointer-events: auto;
}
@supports not (backdrop-filter: blur(8px)) {
	[data-startupstate-flyout] { background: #ffffff; }
}
[data-startupstate-flyout] .ss-header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px 12px;
	margin-bottom: 8px;
}
[data-startupstate-flyout] .ss-header-title {
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 1 1 auto;
	min-width: 0;
}
[data-startupstate-flyout] .ss-tier {
	display: inline-block;
	align-self: flex-start;
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	padding: 2px 8px;
	border-radius: 999px;
}
[data-startupstate-flyout] .ss-tier[data-relevance="top"] { background: rgba(34, 197, 94, 0.15); color: #166534; }
[data-startupstate-flyout] .ss-tier[data-relevance="strong"] { background: rgba(59, 130, 246, 0.15); color: #1e40af; }
[data-startupstate-flyout] .ss-tier[data-relevance="maybe"] { background: rgba(245, 158, 11, 0.15); color: #92400e; }
[data-startupstate-flyout] h4 {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.3;
	/* Host site (startup.utah.gov) has a global h4 color rule that wins on
	   specificity; force our color so the title is readable on the glass. */
	color: #0f172a !important;
}
[data-startupstate-flyout] .ss-section {
	margin-top: 10px;
}
[data-startupstate-flyout] .ss-section-label {
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: #64748b;
	margin-bottom: 4px;
}
[data-startupstate-flyout] .ss-why-list {
	margin: 0;
	padding-left: 16px;
}
[data-startupstate-flyout] .ss-why-list li {
	margin: 2px 0;
}
[data-startupstate-flyout] .ss-benefit {
	margin: 0;
	color: #334155;
}
[data-startupstate-flyout] .ss-capsule {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 14px;
	border-radius: 999px;
	background: linear-gradient(135deg, #1d4ed8, #4338ca);
	color: white;
	text-decoration: none;
	font-weight: 600;
	font-size: 12px;
	box-shadow: 0 4px 12px rgba(67, 56, 202, 0.25);
	flex-shrink: 0;
	white-space: nowrap;
}
[data-startupstate-flyout] .ss-capsule:hover {
	box-shadow: 0 6px 16px rgba(67, 56, 202, 0.35);
}
[data-startupstate-flyout] .ss-citations {
	margin-top: 12px;
	border-top: 1px solid rgba(15, 23, 42, 0.08);
	padding-top: 10px;
}
[data-startupstate-flyout] .ss-citations summary {
	cursor: pointer;
	font-size: 11px;
	color: #475569;
	font-weight: 600;
}
[data-startupstate-flyout] .ss-citation {
	background: rgba(241, 245, 249, 0.7);
	border-left: 2px solid #3b82f6;
	padding: 6px 8px;
	border-radius: 4px;
	margin: 6px 0;
	font-size: 11px;
}
[data-startupstate-flyout] .ss-citation .ss-cite-source {
	font-weight: 600;
	color: #475569;
	text-transform: uppercase;
	font-size: 9px;
	letter-spacing: 0.05em;
}
[data-startupstate-flyout] .ss-citation .ss-cite-keywords {
	color: #1e40af;
	font-size: 10px;
	margin-top: 2px;
}

[data-startupstate-banner] {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 2147483646;
	background: linear-gradient(135deg, #10232a, #ca9538);
	border: 0;
	color: white;
	padding: 10px 16px;
	font: 600 14px/1.4 -apple-system, system-ui, sans-serif;
	display: flex;
	gap: 12px;
	align-items: center;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}
[data-startupstate-banner] .brand-icon {
	width: 26px;
	height: 26px;
	border-radius: 6px;
	flex-shrink: 0;
	display: block;
}
[data-startupstate-banner] .ss-banner-text {
	flex: 1;
}
`;

function injectStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.dataset.startupstate = "true";
	style.textContent = STYLE_CSS;
	document.head.appendChild(style);
}

/**
 * The strip/banner is `position: fixed` so it stays pinned while the page
 * scrolls underneath. To keep the host content visible (the strip otherwise
 * covers the top ~44px of the page), we mirror its height onto
 * `body.padding-top`. The strip can flex-wrap to multiple lines on narrow
 * viewports so the height is observed via ResizeObserver.
 */
function syncBodyPadding() {
	const overlay =
		document.querySelector<HTMLDivElement>("[data-startupstate-gap-strip]") ??
		document.querySelector<HTMLDivElement>("[data-startupstate-banner]");
	if (!overlay) {
		document.body.style.removeProperty("padding-top");
		return;
	}
	const h = Math.ceil(overlay.getBoundingClientRect().height);
	document.body.style.setProperty("padding-top", `${h}px`, "important");
}

let overlayResizeObserver: ResizeObserver | null = null;

function observeOverlayHeight(el: Element) {
	if (!overlayResizeObserver) {
		overlayResizeObserver = new ResizeObserver(() => syncBodyPadding());
	}
	overlayResizeObserver.disconnect();
	overlayResizeObserver.observe(el);
}

async function getIdentity(): Promise<IdentityMessage> {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage({ type: "founderNavigator/getIdentity" }, (response) => {
			resolve(response ?? {});
		});
	});
}

function clearChildren(el: Element): void {
	while (el.firstChild) el.removeChild(el.firstChild);
}

type BannerState = "unauthenticated" | "authenticated-no-profile";

const BANNER_MESSAGES: Record<BannerState, string> = {
	unauthenticated: "Connect your business signals in the extension popup to personalize this page.",
	"authenticated-no-profile":
		"You're signed in. Connect Gmail, Drive, or a local folder in the extension popup, then click Build / refresh profile to personalize this page.",
};

/**
 * Latest desired overlay state, cached so the MutationObserver can re-mount
 * the strip/banner if the host site's hydration removes our injected node.
 */
type CurrentDisplay =
	| { kind: "banner"; state: BannerState }
	| { kind: "strip"; gaps: string[]; matches: ResourceMatch[]; profile: ProfileSummary }
	| null;

let currentDisplay: CurrentDisplay = null;

function renderBanner(state: BannerState) {
	currentDisplay = { kind: "banner", state };
	let banner = document.querySelector<HTMLDivElement>("[data-startupstate-banner]");
	if (!banner) {
		banner = document.createElement("div");
		banner.dataset.startupstateBanner = "true";
		document.body.insertBefore(banner, document.body.firstChild);
	}
	banner.dataset.state = state;
	clearChildren(banner);
	const icon = document.createElement("img");
	icon.src = chrome.runtime.getURL("icon-64.png");
	icon.alt = "";
	icon.className = "brand-icon";
	banner.appendChild(icon);
	const text = document.createElement("span");
	text.className = "ss-banner-text";
	text.textContent = BANNER_MESSAGES[state];
	banner.appendChild(text);
	observeOverlayHeight(banner);
	syncBodyPadding();
}

function removeBanner() {
	document.querySelector("[data-startupstate-banner]")?.remove();
	if (currentDisplay?.kind === "banner") currentDisplay = null;
	syncBodyPadding();
}

function removeGapStrip() {
	document.querySelector("[data-startupstate-gap-strip]")?.remove();
	if (currentDisplay?.kind === "strip") currentDisplay = null;
	syncBodyPadding();
}

function removeBadges() {
	for (const el of document.querySelectorAll("[data-startupstate-badge]")) {
		el.remove();
	}
}

const GAP_STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"the",
	"of",
	"for",
	"to",
	"with",
	"in",
	"on",
	"or",
	"need",
	"needs",
	"no",
	"not",
	"missing",
	"lacking",
	"requires",
	"required",
	"have",
	"has",
	"is",
	"are",
]);

function tokenize(input: string): Set<string> {
	const out = new Set<string>();
	for (const raw of input.toLowerCase().split(/[^a-z0-9]+/)) {
		if (raw.length < 3) continue;
		if (GAP_STOPWORDS.has(raw)) continue;
		out.add(raw);
	}
	return out;
}

/**
 * Return the resource that best matches the gap text. Strategy:
 *   1. Substring containment in title or description (fast win).
 *   2. Token-set overlap against title + description + topics + industries
 *      (handles "founder-led sales" → resources mentioning "founder", "sales").
 *   3. Fall back to the highest-overall-relevance match (`matches[0]`) so the
 *      capsule never points at `#`.
 *   4. If everything fails, link to the founder's site root rather than `#`.
 */
function bestMatchForGap(gap: string, matches: ResourceMatch[]): ResourceMatch | null {
	const lowerGap = gap.toLowerCase();
	const direct = matches.find((m) =>
		`${m.title} ${m.description}`.toLowerCase().includes(lowerGap),
	);
	if (direct) return direct;

	const gapTokens = tokenize(gap);
	if (gapTokens.size === 0) return matches[0] ?? null;

	let best: { match: ResourceMatch; overlap: number } | null = null;
	for (const m of matches) {
		const haystack = [m.title, m.description, ...m.topics, ...m.industries].join(" ");
		const haystackTokens = tokenize(haystack);
		let overlap = 0;
		for (const t of gapTokens) if (haystackTokens.has(t)) overlap++;
		if (overlap === 0) continue;
		if (!best || overlap > best.overlap) best = { match: m, overlap };
	}
	if (best) return best.match;
	return matches[0] ?? null;
}

function renderGapStrip(gaps: string[], matches: ResourceMatch[], profile: ProfileSummary) {
	if (gaps.length === 0) return;
	currentDisplay = { kind: "strip", gaps, matches, profile };
	let strip = document.querySelector<HTMLDivElement>("[data-startupstate-gap-strip]");
	if (!strip) {
		strip = document.createElement("div");
		strip.dataset.startupstateGapStrip = "true";
		document.body.insertBefore(strip, document.body.firstChild);
	}
	clearChildren(strip);
	const icon = document.createElement("img");
	icon.src = chrome.runtime.getURL("icon-64.png");
	icon.alt = "";
	icon.className = "brand-icon";
	strip.appendChild(icon);
	const label = document.createElement("span");
	label.className = "gap-strip-label";
	label.textContent = `${gaps.length} step${gaps.length === 1 ? "" : "s"} you haven't completed yet:`;
	strip.appendChild(label);
	// Render every gap, not just the first three — the count in the
	// label and the pills should agree, and users with five gaps want
	// to see them all.
	for (const gap of gaps) {
		const match = bestMatchForGap(gap, matches);
		const a = document.createElement("a");
		a.className = "gap-link";
		a.textContent = gap;
		a.href = match?.link ?? "https://startup.utah.gov/";
		a.target = "_blank";
		a.rel = "noreferrer";
		if (match) {
			// Hovering a gap-strip pill shows the same rich flyout (why / benefit /
			// CTA / citations) as hovering an on-card capsule, anchored below the
			// pill via positionFlyout.
			attachBadgeHoverHandlers(a, match, profile);
		} else {
			a.title = "Loading match details…";
		}
		strip.appendChild(a);
	}
	observeOverlayHeight(strip);
	syncBodyPadding();
}

function findCardForLink(link: string): HTMLElement | null {
	const anchor = document.querySelector<HTMLAnchorElement>(`a[href*="${link}"]`);
	if (!anchor) return null;
	return anchor.closest("article, .card, .resource, li, section") ?? anchor.parentElement;
}

const RELEVANCE_LABEL: Record<ResourceMatch["relevance"], string> = {
	top: "Top match",
	strong: "Strong match",
	maybe: "Maybe",
};

interface ProfileSummary {
	stage?: string;
	industries: string[];
	geography?: string;
	gaps: string[];
}

/**
 * Compute 1–3 short bullet reasons explaining why this match was chosen.
 * Sources of overlap:
 *   - Industries listed on both profile and match
 *   - Stage on the match that equals the founder's stage
 *   - Founder gaps that appear as substrings in the match's title/description/topics
 * Returns an empty array if nothing overlaps — caller falls back to a generic
 * "We picked this because it matches your profile" copy.
 */
function buildWhyBullets(match: ResourceMatch, profile: ProfileSummary): string[] {
	const out: string[] = [];

	const profileIndustriesLc = profile.industries.map((i) => i.toLowerCase());
	const overlapIndustries = match.industries.filter((mi) =>
		profileIndustriesLc.includes(mi.toLowerCase()),
	);
	if (overlapIndustries.length > 0) {
		out.push(`Matches your industries: ${overlapIndustries.slice(0, 3).join(", ")}`);
	}

	if (profile.stage && match.stages.some((s) => s.toLowerCase() === profile.stage?.toLowerCase())) {
		out.push(`Right for your stage (${profile.stage})`);
	}

	const haystack =
		`${match.title} ${match.description} ${match.topics.join(" ")} ${match.industries.join(" ")}`.toLowerCase();
	for (const gap of profile.gaps) {
		if (out.length >= 3) break;
		const gapTokens = [...tokenize(gap)];
		if (gapTokens.length === 0) continue;
		const hit = gapTokens.some((t) => haystack.includes(t));
		if (hit) out.push(`Addresses gap: ${gap}`);
	}

	if (out.length === 0 && match.topics.length > 0) {
		out.push(`Covers topics: ${match.topics.slice(0, 3).join(", ")}`);
	}

	return out.slice(0, 3);
}

function summarizeBenefit(description: string): string {
	if (!description) return "Click through to the program page for details.";
	const trimmed = description.trim();
	if (trimmed.length <= 180) return trimmed;
	const cut = trimmed.slice(0, 180);
	const lastSpace = cut.lastIndexOf(" ");
	return `${cut.slice(0, lastSpace > 80 ? lastSpace : 180)}…`;
}

// ==================== FLYOUT (singleton, hover-driven) ====================

interface FlyoutState {
	el: HTMLDivElement;
	hideTimer: number | null;
	currentMatchLink: string | null;
}

let flyoutState: FlyoutState | null = null;

function ensureFlyout(): FlyoutState {
	if (flyoutState) return flyoutState;
	const el = document.createElement("div");
	el.dataset.startupstateFlyout = "true";
	el.dataset.visible = "false";
	document.body.appendChild(el);
	const state: FlyoutState = { el, hideTimer: null, currentMatchLink: null };
	el.addEventListener("mouseenter", () => {
		if (state.hideTimer !== null) {
			window.clearTimeout(state.hideTimer);
			state.hideTimer = null;
		}
	});
	el.addEventListener("mouseleave", () => {
		scheduleHide(state);
	});
	flyoutState = state;
	return state;
}

function scheduleHide(state: FlyoutState) {
	if (state.hideTimer !== null) window.clearTimeout(state.hideTimer);
	state.hideTimer = window.setTimeout(() => {
		state.el.dataset.visible = "false";
		state.currentMatchLink = null;
		state.hideTimer = null;
	}, 150);
}

function positionFlyout(card: HTMLElement, flyout: HTMLDivElement) {
	const cardRect = card.getBoundingClientRect();
	const flyoutWidth = 320;
	const margin = 8;
	const viewportW = window.innerWidth;
	const viewportH = window.innerHeight;

	// Horizontal: align to card's left edge, but shift inward if it would
	// overflow the right viewport edge.
	let left = cardRect.left;
	if (left + flyoutWidth > viewportW - margin) {
		left = Math.max(margin, viewportW - flyoutWidth - margin);
	}
	if (left < margin) left = margin;

	// Vertical: prefer just below the card. If there's no room, place above.
	const estimatedHeight = Math.min(420, viewportH * 0.7);
	const spaceBelow = viewportH - cardRect.bottom - margin;
	let top: number;
	if (spaceBelow >= estimatedHeight || spaceBelow >= cardRect.top - margin) {
		top = cardRect.bottom + margin;
	} else {
		top = Math.max(margin, cardRect.top - estimatedHeight - margin);
	}
	if (top + estimatedHeight > viewportH - margin) {
		top = Math.max(margin, viewportH - estimatedHeight - margin);
	}

	flyout.style.left = `${left}px`;
	flyout.style.top = `${top}px`;
}

function renderFlyoutContent(match: ResourceMatch, profile: ProfileSummary, el: HTMLDivElement) {
	clearChildren(el);

	const header = document.createElement("div");
	header.className = "ss-header";
	const headerTitle = document.createElement("div");
	headerTitle.className = "ss-header-title";
	const tier = document.createElement("span");
	tier.className = "ss-tier";
	tier.dataset.relevance = match.relevance;
	tier.textContent = RELEVANCE_LABEL[match.relevance];
	headerTitle.appendChild(tier);
	const heading = document.createElement("h4");
	heading.textContent = match.title;
	headerTitle.appendChild(heading);
	header.appendChild(headerTitle);
	const headerCapsule = document.createElement("a");
	headerCapsule.className = "ss-capsule";
	headerCapsule.href = match.link;
	headerCapsule.target = "_blank";
	headerCapsule.rel = "noreferrer";
	headerCapsule.textContent = "Tap to open program →";
	header.appendChild(headerCapsule);
	el.appendChild(header);

	const whyBullets = buildWhyBullets(match, profile);
	const whySection = document.createElement("div");
	whySection.className = "ss-section";
	const whyLabel = document.createElement("div");
	whyLabel.className = "ss-section-label";
	whyLabel.textContent = "Why";
	whySection.appendChild(whyLabel);
	const whyList = document.createElement("ul");
	whyList.className = "ss-why-list";
	if (whyBullets.length === 0) {
		const li = document.createElement("li");
		li.textContent = "Aligned with your overall founder profile.";
		whyList.appendChild(li);
	} else {
		for (const bullet of whyBullets) {
			const li = document.createElement("li");
			li.textContent = bullet;
			whyList.appendChild(li);
		}
	}
	whySection.appendChild(whyList);
	el.appendChild(whySection);

	const benefitSection = document.createElement("div");
	benefitSection.className = "ss-section";
	const benefitLabel = document.createElement("div");
	benefitLabel.className = "ss-section-label";
	benefitLabel.textContent = "What you get";
	benefitSection.appendChild(benefitLabel);
	const benefitText = document.createElement("p");
	benefitText.className = "ss-benefit";
	benefitText.textContent = summarizeBenefit(match.description);
	benefitSection.appendChild(benefitText);
	el.appendChild(benefitSection);

	if (match.citations.length > 0) {
		const details = document.createElement("details");
		details.className = "ss-citations";
		const summary = document.createElement("summary");
		summary.textContent = `Signals that informed this (${match.citations.length})`;
		details.appendChild(summary);
		for (const citation of match.citations) {
			const block = document.createElement("div");
			block.className = "ss-citation";
			const src = document.createElement("div");
			src.className = "ss-cite-source";
			src.textContent = `${citation.source} · ${citation.title}`;
			block.appendChild(src);
			const snippet = document.createElement("div");
			snippet.textContent = citation.snippet;
			block.appendChild(snippet);
			if (citation.matchedKeywords.length > 0) {
				const kw = document.createElement("div");
				kw.className = "ss-cite-keywords";
				kw.textContent = `Mentions: ${citation.matchedKeywords.join(", ")}`;
				block.appendChild(kw);
			}
			details.appendChild(block);
		}
		el.appendChild(details);
	}
}

function showFlyoutForAnchor(anchor: HTMLElement, match: ResourceMatch, profile: ProfileSummary) {
	const state = ensureFlyout();
	if (state.hideTimer !== null) {
		window.clearTimeout(state.hideTimer);
		state.hideTimer = null;
	}
	if (state.currentMatchLink !== match.link) {
		renderFlyoutContent(match, profile, state.el);
		state.currentMatchLink = match.link;
	}
	positionFlyout(anchor, state.el);
	state.el.dataset.visible = "true";
}

/**
 * Attach hover handlers to the badge itself (not the surrounding card).
 * Each badge is unique per match — when several matches resolve to the same
 * wrapping card via `findCardForLink`, attaching to the card layered N
 * mouseenter listeners on the same DOM node and made it ambiguous which
 * match "won" on hover. The badge is unambiguous: 1 badge ↔ 1 match.
 */
function attachBadgeHoverHandlers(
	badge: HTMLElement,
	match: ResourceMatch,
	profile: ProfileSummary,
) {
	badge.addEventListener("mouseenter", () => showFlyoutForAnchor(badge, match, profile));
	badge.addEventListener("mouseleave", () => {
		if (flyoutState) scheduleHide(flyoutState);
	});
}

function renderBadge(card: HTMLElement, match: ResourceMatch, profile: ProfileSummary) {
	// If this card already has a badge, another match resolved to the same
	// wrapper via `findCardForLink`. Skip — don't pile up duplicate badges or
	// stack additional hover listeners that race with the first one.
	if (card.querySelector("[data-startupstate-badge]")) return;
	const badge = document.createElement("span");
	badge.dataset.startupstateBadge = match.relevance;
	badge.textContent = RELEVANCE_LABEL[match.relevance];
	const heading = card.querySelector("h1, h2, h3, h4, .title, a") ?? card;
	heading.appendChild(badge);
	attachBadgeHoverHandlers(badge, match, profile);
}

function clearFlyout() {
	if (!flyoutState) return;
	if (flyoutState.hideTimer !== null) window.clearTimeout(flyoutState.hideTimer);
	flyoutState.el.remove();
	flyoutState = null;
}

type ResourceMatchArgs =
	typeof api.startupState.resources.matchResources extends FunctionReference<
		"action",
		infer _V,
		infer A
	>
		? A
		: never;

type FounderProfile = NonNullable<
	FunctionReturnType<typeof api.startupState.auth.getFounderByGoogleSub>
>;

interface SessionContext {
	googleSub: string;
	client: ConvexClient;
	unsubscribeProfile: () => void;
	matchedForVersion: number | null;
}

let session: SessionContext | null = null;

async function teardownSession() {
	if (!session) return;
	session.unsubscribeProfile();
	await session.client.close();
	session = null;
}

function clearAugmentations() {
	removeGapStrip();
	removeBadges();
	clearFlyout();
}

async function tryMatchResources(profile: FounderProfile, client: ConvexClient): Promise<void> {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage(
			{ type: "founderNavigator/getAccessToken" },
			async (response: { accessToken?: string }) => {
				if (!response?.accessToken) {
					console.warn("[founder-navigator] no access token; skipping match");
					resolve();
					return;
				}
				try {
					const args: ResourceMatchArgs = {
						accessToken: response.accessToken,
						limit: 25,
					};
					const matches = await client.action(api.startupState.resources.matchResources, args);
					const profileSummary: ProfileSummary = {
						stage: profile.stage,
						industries: profile.industries,
						geography: profile.geography,
						gaps: profile.gaps,
					};
					renderGapStrip(profile.gaps, matches, profileSummary);
					for (const match of matches) {
						const card = findCardForLink(match.link);
						if (card) renderBadge(card, match, profileSummary);
					}
				} catch (err) {
					console.warn("[founder-navigator] match failed", err);
				} finally {
					resolve();
				}
			},
		);
	});
}

async function startSession(googleSub: string) {
	if (session?.googleSub === googleSub) return;
	await teardownSession();

	const client = new ConvexClient(__CONVEX_URL__);
	const ctx: SessionContext = {
		googleSub,
		client,
		unsubscribeProfile: () => {},
		matchedForVersion: null,
	};
	session = ctx;

	ctx.unsubscribeProfile = client.onUpdate(
		api.startupState.auth.getFounderByGoogleSub,
		{ googleSub },
		(profile) => {
			if (session !== ctx) return;
			// Mirror the latest profile into the snapshot cache so the next
			// page load can paint the strip from cache before this query
			// resolves over the network. Preserve popup-owned fields
			// (counts, ingestedHosts) so we don't clobber them.
			void (async () => {
				const existing = await readCachedSnapshot();
				await writeCachedSnapshot({
					profile,
					counts: existing?.counts ?? null,
					ingestedHosts: existing?.ingestedHosts ?? [],
					savedAt: Date.now(),
				});
			})().catch(() => {});
			if (!profile || profile.version === 0) {
				clearAugmentations();
				renderBanner("authenticated-no-profile");
				ctx.matchedForVersion = null;
				return;
			}
			removeBanner();
			if (ctx.matchedForVersion === profile.version) return;
			// Render the strip immediately with the gaps we already know
			// about — `matchResources` makes an OpenAI embedding call
			// that adds 0.5–2s of latency, and the strip showing up
			// right away matters more than the badges/flyouts that need
			// matches. tryMatchResources overwrites this with proper
			// links and hover handlers when it lands.
			if (profile.gaps.length > 0) {
				const profileSummary: ProfileSummary = {
					stage: profile.stage,
					industries: profile.industries,
					geography: profile.geography,
					gaps: profile.gaps,
				};
				renderGapStrip(profile.gaps, [], profileSummary);
			}
			ctx.matchedForVersion = profile.version;
			void tryMatchResources(profile, client);
		},
	);
}

async function syncToIdentity() {
	const identity = await getIdentity();
	if (!identity.googleSub) {
		await teardownSession();
		clearAugmentations();
		renderBanner("unauthenticated");
		return;
	}
	await startSession(identity.googleSub);
}

function watchIdentityChanges() {
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local") return;
		const relevant =
			StorageKeys.GoogleSub in changes ||
			StorageKeys.Email in changes ||
			StorageKeys.FounderId in changes;
		if (relevant) void syncToIdentity();
	});
}

/**
 * Some host pages hydrate after `document_idle` and either replace
 * `document.body` children or wipe direct descendants. Watch body's
 * childList so we can re-insert the strip / banner if it goes missing.
 * Idempotent: if the overlay is already present, the render functions
 * no-op the insertion path.
 */
let bodyMutationObserver: MutationObserver | null = null;

function watchBody() {
	if (bodyMutationObserver) return;
	bodyMutationObserver = new MutationObserver(() => {
		if (!currentDisplay) return;
		if (currentDisplay.kind === "banner") {
			if (!document.querySelector("[data-startupstate-banner]")) {
				renderBanner(currentDisplay.state);
			}
		} else {
			if (!document.querySelector("[data-startupstate-gap-strip]")) {
				renderGapStrip(currentDisplay.gaps, currentDisplay.matches, currentDisplay.profile);
			}
		}
	});
	bodyMutationObserver.observe(document.body, { childList: true });
}

/**
 * Optimistic first paint from `chrome.storage.local`. If the user has a
 * cached profile with gaps, render the strip immediately from cache so a
 * slow Convex round-trip doesn't briefly show the unauthenticated /
 * no-profile banner. The live `onUpdate` callback then overwrites with
 * authoritative data.
 */
async function renderFromCache(): Promise<void> {
	const snap = await readCachedSnapshot();
	if (!snap?.profile || snap.profile.version === 0) return;
	if (snap.profile.gaps.length === 0) return;
	const profileSummary: ProfileSummary = {
		stage: snap.profile.stage,
		industries: snap.profile.industries,
		geography: snap.profile.geography,
		gaps: snap.profile.gaps,
	};
	renderGapStrip(snap.profile.gaps, [], profileSummary);
}

async function main() {
	if (!location.hostname.includes("startup.utah.gov")) return;
	injectStyles();
	watchBody();
	watchIdentityChanges();
	await renderFromCache();
	await syncToIdentity();
}

main().catch((err) => {
	console.warn("[founder-navigator] fatal:", err);
});
