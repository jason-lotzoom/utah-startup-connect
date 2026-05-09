/**
 * Content script — mounts the founder-navigator overlay on
 * `startup.utah.gov`. Three augmentations:
 *   1. Top-of-page gap-analysis strip (data-startupstate-gap-strip)
 *   2. Per-card relevance badges    (data-startupstate-badge)
 *   3. Hover side panel with citations (data-startupstate-side-panel)
 *
 * The script is non-destructive: every injected node carries a
 * `data-startupstate-*` attribute and is removed on extension disable.
 */

import { ConvexClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";

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
	position: sticky;
	top: 0;
	z-index: 99999;
	background: linear-gradient(135deg, #1d4ed8, #4338ca);
	color: white;
	padding: 10px 16px;
	font: 600 14px/1.4 -apple-system, system-ui, sans-serif;
	display: flex;
	gap: 12px;
	align-items: center;
}
[data-startupstate-gap-strip] .gap-link {
	background: rgba(255,255,255,0.15);
	color: white;
	padding: 4px 10px;
	border-radius: 999px;
	text-decoration: none;
	font-size: 12px;
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

[data-startupstate-side-panel] {
	position: fixed;
	right: 16px;
	top: 80px;
	width: 320px;
	max-height: 70vh;
	overflow-y: auto;
	background: white;
	border: 1px solid #e2e8f0;
	border-radius: 12px;
	box-shadow: 0 10px 30px rgba(15,23,42,0.18);
	padding: 16px;
	z-index: 99999;
	font: 13px/1.5 -apple-system, system-ui, sans-serif;
	color: #0f172a;
}
[data-startupstate-side-panel] h3 {
	margin: 0 0 8px;
	font-size: 14px;
}
[data-startupstate-side-panel] .citation {
	background: #f1f5f9;
	border-left: 3px solid #3b82f6;
	padding: 8px 10px;
	border-radius: 6px;
	margin: 8px 0;
}
[data-startupstate-side-panel] .citation .source {
	font-weight: 600;
	color: #475569;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin-bottom: 4px;
}
[data-startupstate-side-panel] button.close {
	float: right;
	border: none;
	background: transparent;
	font-size: 18px;
	cursor: pointer;
	color: #64748b;
}

[data-startupstate-banner] {
	background: #fef9c3;
	border: 1px solid #fde047;
	color: #854d0e;
	padding: 10px 14px;
	border-radius: 8px;
	margin: 12px 16px;
	font: 13px -apple-system, system-ui, sans-serif;
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

function renderUnconnectedBanner() {
	if (document.querySelector("[data-startupstate-banner]")) return;
	const banner = document.createElement("div");
	banner.dataset.startupstateBanner = "true";
	banner.textContent =
		"Connect your business signals in the extension popup to personalize this page.";
	document.body.insertBefore(banner, document.body.firstChild);
}

function renderGapStrip(gaps: string[], topMatchByGap: Map<string, ResourceMatch>) {
	if (gaps.length === 0) return;
	let strip = document.querySelector<HTMLDivElement>("[data-startupstate-gap-strip]");
	if (!strip) {
		strip = document.createElement("div");
		strip.dataset.startupstateGapStrip = "true";
		document.body.insertBefore(strip, document.body.firstChild);
	}
	clearChildren(strip);
	const label = document.createElement("span");
	label.textContent = `${gaps.length} step${gaps.length === 1 ? "" : "s"} you haven't completed yet:`;
	strip.appendChild(label);
	for (const gap of gaps.slice(0, 3)) {
		const match = topMatchByGap.get(gap);
		const a = document.createElement("a");
		a.className = "gap-link";
		a.textContent = gap;
		a.href = match?.link ?? "#";
		a.target = "_blank";
		a.rel = "noreferrer";
		strip.appendChild(a);
	}
}

function findCardForLink(link: string): HTMLElement | null {
	const anchor = document.querySelector<HTMLAnchorElement>(`a[href*="${link}"]`);
	if (!anchor) return null;
	return anchor.closest("article, .card, .resource, li, section") ?? anchor.parentElement;
}

function renderBadge(card: HTMLElement, match: ResourceMatch) {
	if (card.querySelector("[data-startupstate-badge]")) return;
	const badge = document.createElement("span");
	badge.dataset.startupstateBadge = match.relevance;
	badge.textContent =
		match.relevance === "top"
			? "Top match"
			: match.relevance === "strong"
				? "Strong match"
				: "Maybe";
	const heading = card.querySelector("h1, h2, h3, h4, .title, a") ?? card;
	heading.appendChild(badge);
	card.addEventListener("mouseenter", () => renderSidePanel(match));
}

function renderSidePanel(match: ResourceMatch) {
	let panel = document.querySelector<HTMLDivElement>("[data-startupstate-side-panel]");
	if (!panel) {
		panel = document.createElement("div");
		panel.dataset.startupstateSidePanel = "true";
		document.body.appendChild(panel);
	}
	clearChildren(panel);
	const close = document.createElement("button");
	close.className = "close";
	close.textContent = "×";
	close.onclick = () => panel?.remove();
	panel.appendChild(close);
	const heading = document.createElement("h3");
	heading.textContent = match.title;
	panel.appendChild(heading);
	if (match.citations.length === 0) {
		const empty = document.createElement("p");
		empty.textContent = "No citations available yet — connect more signals.";
		panel.appendChild(empty);
		return;
	}
	for (const citation of match.citations) {
		const block = document.createElement("div");
		block.className = "citation";
		const src = document.createElement("div");
		src.className = "source";
		src.textContent = `${citation.source} · ${citation.title}`;
		block.appendChild(src);
		const snippet = document.createElement("div");
		snippet.textContent = citation.snippet;
		block.appendChild(snippet);
		panel.appendChild(block);
	}
}

type ResourceMatchArgs =
	typeof api.startupState.resources.matchResources extends FunctionReference<
		"action",
		infer _V,
		infer A
	>
		? A
		: never;

async function main() {
	if (!location.hostname.includes("startup.utah.gov")) return;
	injectStyles();
	const identity = await getIdentity();
	if (!identity.googleSub) {
		renderUnconnectedBanner();
		return;
	}

	const client = new ConvexClient(__CONVEX_URL__);

	const profile = await client.query(api.startupState.auth.getFounderByGoogleSub, {
		googleSub: identity.googleSub,
	});
	if (!profile || profile.version === 0) {
		renderUnconnectedBanner();
		await client.close();
		return;
	}

	chrome.runtime.sendMessage(
		{ type: "founderNavigator/getAccessToken" },
		async (response: { accessToken?: string }) => {
			if (!response?.accessToken) {
				console.warn("[founder-navigator] no access token; skipping match");
				await client.close();
				return;
			}
			try {
				const args: ResourceMatchArgs = {
					accessToken: response.accessToken,
					limit: 25,
				};
				const matches = await client.action(api.startupState.resources.matchResources, args);
				const gapsToTopMatch = new Map<string, ResourceMatch>();
				for (const gap of profile.gaps) {
					const m = matches.find((x) =>
						`${x.title} ${x.description}`.toLowerCase().includes(gap.toLowerCase()),
					);
					if (m) gapsToTopMatch.set(gap, m);
				}
				renderGapStrip(profile.gaps, gapsToTopMatch);
				for (const match of matches) {
					const card = findCardForLink(match.link);
					if (card) renderBadge(card, match);
				}
			} catch (err) {
				console.warn("[founder-navigator] match failed", err);
			} finally {
				await client.close();
			}
		},
	);
}

main().catch((err) => {
	console.warn("[founder-navigator] fatal:", err);
});
