/**
 * Popup UI — the primary entry point a founder sees when clicking the
 * extension's toolbar icon. Renders three states:
 *   1. Not connected → "Connect Google" CTA
 *   2. Connected → three "signal source" rows (Gmail, Drive, Local) with
 *      per-source status pills + "Run inference" CTA
 *   3. Profile ready → inferred chips + reminder to visit startup.utah.gov
 */

import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import {
	type AccessTokenResult,
	clearAccessTokenCache,
	getAccessToken,
	revokeAccessTokenAtGoogle,
} from "../auth/identity";
import { pickAndReadFolder } from "../ingest/local";
import { getConvexClient } from "../lib/convexClient";
import { clearCachedSnapshot, readCachedSnapshot, writeCachedSnapshot } from "../lib/snapshot";
import { clearStorage, getStorage, StorageKeys, setStorage } from "../lib/storage";

type SourceState = "idle" | "busy" | "done" | "error";

interface SourceStatus {
	state: SourceState;
	message: string;
}

const initialSource: SourceStatus = { state: "idle", message: "Not connected" };

/**
 * Captions cycled in the inference progress card. Order doesn't matter —
 * each caption is rotated every ~3s independent of phase, so the user
 * sees motion even while the LLM call sits idle on the wire.
 *
 * Tone: a tiny bit cheeky, but always concrete about what's happening.
 */
const DOCUMENT_CAPTIONS = [
	"Sniffing through your docs for hidden gems…",
	"Reading filenames like a detective…",
	"Cross-referencing your hustle with Utah's startup scene…",
	"Decoding founder vibes from your business notes…",
	"Looking for the words 'pitch deck' (gently)…",
	"Sorting documents into 'has co-founder' and 'still rolling solo'…",
	"Counting how many times you typed 'MVP' this quarter…",
	"Inferring your stage without asking you to fill out a form…",
	"Asking the AI to be diplomatic about your gaps…",
	"Brewing the perfect founder smoothie…",
];

const AUGMENT_CAPTIONS = [
	"Reading recent emails through your business lens…",
	"Filtering newsletters out, keeping the real signal…",
	"Spotting fresh wins and fresh problems in your inbox…",
	"Updating gaps based on this quarter's chatter…",
	"Asking your inbox what's changed since last week…",
	"Cross-checking emails against your document profile…",
	"Refining stage based on recent business activity…",
	"Hunting for 'we just closed' and 'we still need'…",
];

interface ConnectedFounder {
	googleSub: string;
	email: string;
	founderId: string;
}

interface DriveFolderCrumb {
	id: string;
	name: string;
	/** The Shared Drive this crumb lives in, or undefined for My Drive. */
	driveId?: string;
}

interface DriveFolderEntry {
	id: string;
	name: string;
	driveId?: string;
	kind?: "folder" | "sharedDrive";
}

interface DrivePickerState {
	loading: boolean;
	error: string | null;
	folders: DriveFolderEntry[];
	stack: DriveFolderCrumb[];
}

const DRIVES_ROOT_CRUMB: DriveFolderCrumb = { id: "drives-root", name: "Drives" };

type FounderProfile = NonNullable<
	FunctionReturnType<typeof api.startupState.auth.getFounderByGoogleSub>
>;

type SignalCounts = FunctionReturnType<typeof api.startupState.auth.getFounderSignalCounts>;

const ZERO_COUNTS: SignalCounts = {
	founderId: null,
	gmail: 0,
	drive: 0,
	driveFolders: 0,
	local: 0,
};

type IngestedHosts = FunctionReturnType<typeof api.startupState.auth.getFounderIngestedHosts>;

function countLabel(n: number, singular: string, plural: string): string | null {
	if (n <= 0) return null;
	return `${n} ${n === 1 ? singular : plural}`;
}

export function App() {
	const [error, setError] = useState<string | null>(null);
	const [connecting, setConnecting] = useState(false);
	const [founder, setFounder] = useState<ConnectedFounder | null>(null);
	const [profile, setProfile] = useState<FounderProfile | null>(null);
	const [counts, setCounts] = useState<SignalCounts>(ZERO_COUNTS);
	const [gmail, setGmail] = useState<SourceStatus>(initialSource);
	const [drive, setDrive] = useState<SourceStatus>(initialSource);
	const [local, setLocal] = useState<SourceStatus>(initialSource);
	const [captionIdx, setCaptionIdx] = useState(0);
	const [disconnecting, setDisconnecting] = useState(false);
	const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
	const [drivePicker, setDrivePicker] = useState<DrivePickerState | null>(null);
	const [website, setWebsite] = useState<SourceStatus>(initialSource);
	const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
	const [ingestedHosts, setIngestedHosts] = useState<IngestedHosts>([]);
	// `hydrated` flips true after we've checked chrome.storage.local for an
	// existing session. Until then, render nothing — otherwise slow storage
	// reads cause a flash of the "Connect Google" UI for already-connected
	// users.
	const [hydrated, setHydrated] = useState(false);

	const inferencePhase = profile?.inferencePhase;
	const inferenceRunning =
		inferencePhase === "gathering" ||
		inferencePhase === "analyzing" ||
		inferencePhase === "synthesizing";

	const tabContext = (() => {
		if (!currentTabUrl) return { onStartupUtah: true, isHttp: false, hostname: null };
		try {
			const u = new URL(currentTabUrl);
			return {
				onStartupUtah: u.hostname === "startup.utah.gov",
				isHttp: u.protocol === "http:" || u.protocol === "https:",
				hostname: u.hostname,
			};
		} catch {
			return { onStartupUtah: true, isHttp: false, hostname: null };
		}
	})();

	// Reset caption rotation each time a new inference begins so the
	// user sees the first caption first, not whatever the previous run
	// happened to leave us on.
	useEffect(() => {
		if (inferencePhase === "gathering") setCaptionIdx(0);
	}, [inferencePhase]);

	useEffect(() => {
		if (!inferenceRunning) return;
		const id = setInterval(() => {
			setCaptionIdx((i) => i + 1);
		}, 3000);
		return () => clearInterval(id);
	}, [inferenceRunning]);

	// Write through to the snapshot cache after each tracked state change so
	// the next popup open / page reload paints the connected UI immediately.
	// Gated on `hydrated` so we don't overwrite a fresh cache with the
	// pre-restore zero state on first mount.
	useEffect(() => {
		if (!hydrated || !founder) return;
		void writeCachedSnapshot({
			profile,
			counts,
			ingestedHosts,
			savedAt: Date.now(),
		});
	}, [hydrated, founder, profile, counts, ingestedHosts]);

	useEffect(() => {
		(async () => {
			try {
				const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
				setCurrentTabUrl(tabs[0]?.url ?? null);
			} catch {
				setCurrentTabUrl(null);
			}
		})();
	}, []);

	useEffect(() => {
		(async () => {
			// Optimistic restore: paint from the last-known snapshot before
			// Convex subscriptions finish their first round-trip. The live
			// updates below overwrite it as soon as they arrive.
			const snap = await readCachedSnapshot();
			if (snap) {
				if (snap.profile) setProfile(snap.profile);
				if (snap.counts) setCounts(snap.counts);
				setIngestedHosts(snap.ingestedHosts);
			}

			const sub = await getStorage<string>(StorageKeys.GoogleSub);
			const email = await getStorage<string>(StorageKeys.Email);
			const founderId = await getStorage<string>(StorageKeys.FounderId);
			if (sub && email && founderId) {
				setFounder({ googleSub: sub, email, founderId });
				subscribeProfile(sub, setProfile);
				subscribeCounts(sub, setCounts);
				subscribeIngestedHosts(sub, setIngestedHosts);
				setHydrated(true);
				return;
			}
			// Self-heal: if Chrome has a cached OAuth token but our storage is
			// empty, a previous OAuth consent flow likely completed after the
			// popup was closed by the consent UI stealing focus. Re-run the
			// (idempotent) registerFounder so the UI lands on connected state
			// without forcing a second Connect click.
			const token = await getAccessToken(false);
			if (!token) {
				setHydrated(true);
				return;
			}
			try {
				await registerWithToken(token, {
					setFounder,
					setProfile,
					setCounts,
					setHosts: setIngestedHosts,
				});
			} catch {
				// Cached token is stale or revoked — fall back to Connect button.
			}
			setHydrated(true);
		})();
	}, []);

	async function handleConnect() {
		setError(null);
		setConnecting(true);
		try {
			const token = await getAccessToken(true);
			if (!token) throw new Error("Sign-in cancelled");
			await registerWithToken(token, {
				setFounder,
				setProfile,
				setCounts,
				setHosts: setIngestedHosts,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign-in failed");
		} finally {
			setConnecting(false);
		}
	}

	async function withFreshToken<T>(fn: (accessToken: string) => Promise<T>): Promise<T> {
		const token = await getAccessToken(false);
		if (!token) throw new Error("Re-authenticate via Connect Google");
		try {
			return await fn(token.accessToken);
		} catch (err) {
			// On 401-ish errors, clear cache so the next attempt re-prompts
			if (err instanceof Error && /401|invalid_token|userinfo/i.test(err.message)) {
				await clearAccessTokenCache(token.accessToken);
			}
			throw err;
		}
	}

	async function loadDriveFolders(crumb: DriveFolderCrumb): Promise<DriveFolderEntry[]> {
		const result = await withFreshToken((accessToken) =>
			getConvexClient().action(api.startupState.ingest.listDriveFoldersForPicker, {
				accessToken,
				parentId: crumb.id,
				driveId: crumb.driveId,
			}),
		);
		return result.folders;
	}

	async function openDrivePicker() {
		setError(null);
		setDrivePicker({ loading: true, error: null, folders: [], stack: [DRIVES_ROOT_CRUMB] });
		try {
			const folders = await loadDriveFolders(DRIVES_ROOT_CRUMB);
			setDrivePicker({ loading: false, error: null, folders, stack: [DRIVES_ROOT_CRUMB] });
		} catch (err) {
			setDrivePicker({
				loading: false,
				error: err instanceof Error ? err.message : "Failed to list Drive folders",
				folders: [],
				stack: [DRIVES_ROOT_CRUMB],
			});
		}
	}

	async function drillIntoDriveFolder(entry: DriveFolderEntry) {
		setDrivePicker((current) => {
			if (!current) return current;
			return { ...current, loading: true, error: null };
		});
		// A Shared Drive entry's `id` *is* the driveId; entering it
		// scopes subsequent listings to that drive. A regular folder
		// inherits its parent crumb's driveId.
		const parent = drivePicker?.stack[drivePicker.stack.length - 1];
		const nextCrumb: DriveFolderCrumb = {
			id: entry.id,
			name: entry.name,
			driveId: entry.kind === "sharedDrive" ? entry.id : (entry.driveId ?? parent?.driveId),
		};
		try {
			const folders = await loadDriveFolders(nextCrumb);
			setDrivePicker((current) => {
				if (!current) return current;
				return {
					loading: false,
					error: null,
					folders,
					stack: [...current.stack, nextCrumb],
				};
			});
		} catch (err) {
			setDrivePicker((current) => {
				if (!current) return current;
				return {
					...current,
					loading: false,
					error: err instanceof Error ? err.message : "Failed to list Drive folders",
				};
			});
		}
	}

	async function popDrivePicker() {
		setDrivePicker((current) => {
			if (!current || current.stack.length <= 1) return current;
			return { ...current, loading: true, error: null };
		});
		const target = drivePicker?.stack.slice(0, -1).pop();
		if (!target) return;
		try {
			const folders = await loadDriveFolders(target);
			setDrivePicker((current) => {
				if (!current) return current;
				return {
					loading: false,
					error: null,
					folders,
					stack: current.stack.slice(0, -1),
				};
			});
		} catch (err) {
			setDrivePicker((current) => {
				if (!current) return current;
				return {
					...current,
					loading: false,
					error: err instanceof Error ? err.message : "Failed to list Drive folders",
				};
			});
		}
	}

	async function pickDriveFolder(folderId: string) {
		setDrivePicker(null);
		setError(null);
		setDrive({ state: "busy", message: "Sweeping Drive folder…" });
		try {
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.sweepDrive, {
					accessToken,
					folderId,
				}),
			);
			setDrive({
				state: "done",
				message: `Ingested ${result.ingested} files (${result.skipped} skipped)`,
			});
			autoBuildDocumentProfile();
		} catch (err) {
			setDrive({
				state: "error",
				message: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	async function handleCrawlWebsite() {
		setError(null);
		const raw = window.prompt(
			"Crawl what site?\n\n" +
				"Paste any URL — we'll fetch it plus first- and second-level same-origin links, " +
				"convert each page to markdown, and add them to your local document corpus.",
			"https://",
		);
		if (!raw) return;
		let normalized: string;
		try {
			const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
			normalized = u.toString();
		} catch {
			setWebsite({ state: "error", message: "Not a valid URL" });
			return;
		}
		setWebsite({ state: "busy", message: "Crawling…" });
		try {
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.crawlAndIngestWebsite, {
					accessToken,
					url: normalized,
				}),
			);
			setWebsite({
				state: "done",
				message: `Ingested ${result.ingested} pages from ${result.hostname}`,
			});
			autoBuildDocumentProfile();
		} catch (err) {
			setWebsite({
				state: "error",
				message: err instanceof Error ? err.message : "Crawl failed",
			});
		}
	}

	async function handleCrawlCurrentTab() {
		if (!currentTabUrl) return;
		setError(null);
		setWebsite({ state: "busy", message: "Crawling…" });
		try {
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.crawlAndIngestWebsite, {
					accessToken,
					url: currentTabUrl,
				}),
			);
			setWebsite({
				state: "done",
				message: `Ingested ${result.ingested} pages from ${result.hostname}`,
			});
			autoBuildDocumentProfile();
		} catch (err) {
			setWebsite({
				state: "error",
				message: err instanceof Error ? err.message : "Crawl failed",
			});
		}
	}

	async function handleContinueToStartupUtah() {
		setError(null);
		try {
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
			const tabId = tabs[0]?.id;
			if (typeof tabId !== "number") {
				throw new Error("No active tab");
			}
			await chrome.tabs.update(tabId, { url: "https://startup.utah.gov/" });
			window.close();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not open startup.utah.gov");
		}
	}

	async function handleSweepLocal() {
		setError(null);
		setLocal({ state: "busy", message: "Reading folder…" });
		try {
			const files = await pickAndReadFolder({ recursive: true });
			// Convex caps action args at 16 MiB total, so a folder of
			// 200+ markdown files can blow the limit even when every
			// individual file is small. Chunk into batches that stay
			// well under the cap and tally the result across calls.
			const MAX_BATCH_BYTES = 8 * 1024 * 1024;
			const batches: (typeof files)[] = [];
			let current: typeof files = [];
			let currentBytes = 0;
			for (const f of files) {
				// Approximate JSON-encoded size: extractedText length +
				// path length + per-field framing overhead.
				const approx = f.extractedText.length + f.relativePath.length + 200;
				if (currentBytes + approx > MAX_BATCH_BYTES && current.length > 0) {
					batches.push(current);
					current = [];
					currentBytes = 0;
				}
				current.push(f);
				currentBytes += approx;
			}
			if (current.length > 0) batches.push(current);

			let ingested = 0;
			let skipped = 0;
			for (let i = 0; i < batches.length; i++) {
				const batch = batches[i];
				setLocal({
					state: "busy",
					message:
						batches.length > 1
							? `Uploading batch ${i + 1}/${batches.length} (${batch.length} files)…`
							: `Uploading ${batch.length} files…`,
				});
				const result = await withFreshToken((accessToken) =>
					getConvexClient().action(api.startupState.ingest.writeLocalSignals, {
						accessToken,
						files: batch,
					}),
				);
				ingested += result.ingested;
				skipped += result.skipped;
			}
			setLocal({
				state: "done",
				message: `Ingested ${ingested} files (${skipped} skipped)`,
			});
			autoBuildDocumentProfile();
		} catch (err) {
			setLocal({
				state: "error",
				message: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	/**
	 * Fire-and-forget profile build after a successful document ingest.
	 * The backend `beginInference` is idempotent — racing calls land on
	 * the same in-flight run rather than stacking LLM costs.
	 */
	function autoBuildDocumentProfile(): void {
		void (async () => {
			try {
				await withFreshToken((accessToken) =>
					getConvexClient().action(api.startupState.profile.runInference, { accessToken }),
				);
			} catch (err) {
				if (err instanceof Error) {
					console.warn("[founder-navigator] auto profile build failed:", err.message);
				}
			}
		})();
	}

	async function handleDisconnect() {
		setError(null);
		setDisconnectMessage(null);
		const ok = window.confirm(
			"Disconnect and remove all data?\n\n" +
				"This will:\n" +
				"  • Delete your founder profile, ingested signals, and ingest runs from the backend.\n" +
				"  • Revoke the extension's access to your Gmail and Drive at Google.\n" +
				"  • Clear local extension state.\n\n" +
				"You can reconnect later by clicking 'Connect Google' again.",
		);
		if (!ok) return;
		setDisconnecting(true);
		try {
			const token = await getAccessToken(false);
			if (token) {
				try {
					await getConvexClient().action(api.startupState.auth.disconnectAndDelete, {
						accessToken: token.accessToken,
					});
				} catch (err) {
					console.warn("[founder-navigator] backend delete failed", err);
				}
				await revokeAccessTokenAtGoogle(token.accessToken);
				await clearAccessTokenCache(token.accessToken);
			}
			await clearStorage(
				StorageKeys.GoogleSub,
				StorageKeys.Email,
				StorageKeys.FounderId,
				StorageKeys.GmailLastSweepAt,
				StorageKeys.DriveLastSweepAt,
				StorageKeys.LocalLastSweepAt,
			);
			await clearCachedSnapshot();
			setFounder(null);
			setProfile(null);
			setCounts(ZERO_COUNTS);
			setIngestedHosts([]);
			setGmail(initialSource);
			setDrive(initialSource);
			setLocal(initialSource);
			setDisconnectMessage("Disconnected and removed.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Disconnect failed");
		} finally {
			setDisconnecting(false);
		}
	}

	async function handleOpenSidePanel() {
		setError(null);
		try {
			const tab = await chrome.tabs.query({ active: true, currentWindow: true });
			const windowId = tab[0]?.windowId;
			if (typeof windowId !== "number") {
				throw new Error("No active window");
			}
			await chrome.sidePanel.open({ windowId });
			// Dismiss the popup so the side panel has the full right edge.
			window.close();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not open side panel");
		}
	}

	async function handleRemoveGmail() {
		setError(null);
		setGmail({ state: "busy", message: "Removing emails…" });
		try {
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.removeGmailSignals, { accessToken }),
			);
			setGmail({
				state: "idle",
				message: `Removed ${result.deletedSignals} emails`,
			});
		} catch (err) {
			setGmail({
				state: "error",
				message: err instanceof Error ? err.message : "Failed to remove",
			});
		}
	}

	async function handleSweepGmailAndAugment() {
		setError(null);
		setGmail({ state: "busy", message: "Reading your emails…" });
		try {
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.sweepGmail, {
					accessToken,
					maxResults: 100,
				}),
			);
			setGmail({
				state: "busy",
				message: `Ingested ${result.ingested} · augmenting profile…`,
			});
			await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.profile.augmentWithEmails, { accessToken }),
			);
			setGmail({
				state: "done",
				message: `Augmented with ${result.ingested} new emails`,
			});
		} catch (err) {
			setGmail({
				state: "error",
				message: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	function phaseHeadline(): string {
		const kind = profile?.inferenceKind;
		if (inferencePhase === "gathering") return "Gathering signals…";
		if (inferencePhase === "synthesizing") return "Writing your profile…";
		if (inferencePhase === "analyzing") {
			return kind === "augmentation"
				? "Augmenting with email signals…"
				: "Analyzing your documents…";
		}
		return "Working…";
	}

	const captions = profile?.inferenceKind === "augmentation" ? AUGMENT_CAPTIONS : DOCUMENT_CAPTIONS;

	function pillClass(state: SourceState): string {
		if (state === "done") return "pill success";
		if (state === "busy") return "pill busy";
		if (state === "error") return "pill error";
		return "pill";
	}

	return (
		<div className="root">
			<div className="title-row">
				<div className="title-left">
					<img
						src={chrome.runtime.getURL("icon-64.png")}
						alt=""
						className="brand-icon"
						width={28}
						height={28}
					/>
					<h1 className="title">Founder Navigator</h1>
				</div>
			</div>
			<p className="subtitle">Personalize startup.utah.gov to your business.</p>
			{disconnectMessage ? <div className="success-message">{disconnectMessage}</div> : null}
			{!hydrated ? null : !founder ? (
				<>
					<button type="button" className="cta" onClick={handleConnect} disabled={connecting}>
						{connecting ? "Connecting…" : "Connect Google"}
					</button>
					<p className="note">
						We'll request read-only access to your Gmail and Drive so we can build a personalized
						profile. Cancel anytime.
					</p>
				</>
			) : (
				<>
					{!tabContext.onStartupUtah
						? (() => {
								const profileBuilt = (profile?.version ?? 0) >= 1;
								const showContinue = website.state === "done" && !inferenceRunning && profileBuilt;
								const alreadyIngested =
									!!tabContext.hostname && ingestedHosts.includes(tabContext.hostname);
								const docCount = counts.local + counts.drive;
								const working = website.state === "busy" || inferenceRunning;
								return (
									<div className="off-site">
										{showContinue ? (
											<button
												type="button"
												className="cta cta-gold"
												onClick={handleContinueToStartupUtah}
											>
												<span>Continue to</span>
												<img
													src={chrome.runtime.getURL("sus.png")}
													alt="Startup.Utah.gov"
													className="cta-gold-logo"
												/>
											</button>
										) : alreadyIngested ? (
											<>
												<p className="off-site-desc">
													You have already added this website to your profile. If there have been
													changes to the website we can pull the latest updates for you.
												</p>
												<button
													type="button"
													className="cta"
													onClick={handleCrawlCurrentTab}
													disabled={!tabContext.isHttp || working}
												>
													{working ? "Working…" : "Update my profile"}
												</button>
												<button
													type="button"
													className="cta secondary"
													onClick={handleOpenSidePanel}
													disabled={docCount === 0}
													title="Open a slide-out panel with the file tree of ingested Drive and Local files."
												>
													Show files ({docCount})
												</button>
											</>
										) : (
											<button
												type="button"
												className="cta"
												onClick={handleCrawlCurrentTab}
												disabled={!tabContext.isHttp || working}
												title={
													tabContext.isHttp
														? "Crawl this site plus its first- and second-level same-origin links into your document corpus"
														: "Open an http(s) page to crawl it"
												}
											>
												{working ? "Working…" : "This is my business"}
											</button>
										)}
									</div>
								);
							})()
						: null}
					{tabContext.onStartupUtah
						? (() => {
								// Live status (busy/error) still shows as a pill on the right.
								// Idle counts are folded into the label itself —
								// "🧑‍💻 3 Websites added" reads better than the same text
								// stranded in a separate capsule.
								const websiteLivePill =
									website.state !== "idle"
										? { className: pillClass(website.state), text: website.message }
										: null;
								const localLivePill =
									local.state !== "idle"
										? { className: pillClass(local.state), text: local.message }
										: null;
								const driveLivePill =
									drive.state !== "idle"
										? { className: pillClass(drive.state), text: drive.message }
										: null;
								const websiteLabel =
									countLabel(ingestedHosts.length, "Website added", "Websites added") ??
									"Website";
								const localLabel =
									countLabel(counts.local, "File added", "Files added") ?? "Files";
								const driveLabel =
									countLabel(counts.driveFolders, "Drive connected", "Drives connected") ??
									"Drive";
								// Gmail surfaces busy/error inline, but its connected state is
								// expressed in the label ("Gmail connected") + a red Remove
								// button — so no idle pill.
								const gmailPill =
									gmail.state !== "idle"
										? { className: pillClass(gmail.state), text: gmail.message }
										: null;
								const gmailConnected = counts.gmail > 0 && gmail.state === "idle";

								const docCount = counts.local + counts.drive;
								const docProfileBuilt =
									(profile?.version ?? 0) >= 1 &&
									(profile?.inferenceKind === "documents" ||
										profile?.inferenceKind === "augmentation");
								const isAugmenting = inferenceRunning && profile?.inferenceKind === "augmentation";
								const step2Locked = !docProfileBuilt;

								return (
									<>
										<div className="step-header">Step 1 - Documents</div>

										<div className="row">
											<div className="label">🧑‍💻 {websiteLabel}</div>
											<div style={{ display: "flex", alignItems: "center" }}>
												{websiteLivePill ? (
													<span className={websiteLivePill.className}>
														{website.state === "busy" ? <span className="spinner" /> : null}
														{websiteLivePill.text}
													</span>
												) : null}
												<button
													type="button"
													disabled={website.state === "busy"}
													onClick={handleCrawlWebsite}
													title="Crawl a URL plus its first- and second-level same-origin links into local markdown documents"
												>
													Add
												</button>
											</div>
										</div>

										<div className="row">
											<div className="label">📁 {localLabel}</div>
											<div style={{ display: "flex", alignItems: "center" }}>
												{localLivePill ? (
													<span className={localLivePill.className}>
														{local.state === "busy" ? <span className="spinner" /> : null}
														{localLivePill.text}
													</span>
												) : null}
												<button
													type="button"
													disabled={local.state === "busy"}
													onClick={handleSweepLocal}
												>
													Choose
												</button>
											</div>
										</div>
										<div className="row row-solid">
											<div className="label label-with-icon">
												<img
													src={chrome.runtime.getURL("drive.png")}
													alt="Google"
													className="row-icon"
												/>
												{driveLabel}
											</div>
											<div style={{ display: "flex", alignItems: "center" }}>
												{driveLivePill ? (
													<span className={driveLivePill.className}>
														{drive.state === "busy" ? <span className="spinner" /> : null}
														{driveLivePill.text}
													</span>
												) : null}
												<button
													type="button"
													disabled={drive.state === "busy"}
													onClick={openDrivePicker}
												>
													Connect
												</button>
											</div>
										</div>

										<button
											type="button"
											className="cta secondary"
											onClick={handleOpenSidePanel}
											disabled={docCount === 0}
											title="Open a slide-out panel with the file tree of ingested Drive and Local files."
										>
											Show files ({docCount})
										</button>

										<div className={`step-header${step2Locked ? " step-locked" : ""}`}>
											Step 2 - Interactions
										</div>

										<div className={`row row-solid${step2Locked ? " row-locked" : ""}`}>
											<div className="label label-with-icon">
												<img
													src={chrome.runtime.getURL("gmail.png")}
													alt=""
													className="row-icon"
												/>
												{gmailConnected ? "Gmail connected" : "Gmail"}
											</div>
											<div style={{ display: "flex", alignItems: "center" }}>
												{gmailPill ? (
													<span className={gmailPill.className}>
														{gmail.state === "busy" ? <span className="spinner" /> : null}
														{gmailPill.text}
													</span>
												) : null}
												{gmailConnected ? (
													<button
														type="button"
														className="danger"
														disabled={gmail.state === "busy" || isAugmenting}
														onClick={handleRemoveGmail}
														title="Disconnect Gmail and remove all ingested emails from your profile."
													>
														Remove
													</button>
												) : (
													<button
														type="button"
														disabled={step2Locked || gmail.state === "busy" || isAugmenting}
														onClick={handleSweepGmailAndAugment}
														title={
															step2Locked
																? "Available after your document profile is built"
																: "Sweep recent emails and augment your profile"
														}
													>
														Connect
													</button>
												)}
											</div>
										</div>
									</>
								);
							})()
						: null}
					{(() => {
						// One unified progress card surfaces whatever's currently
						// happening so the user sees sustained activity from
						// "Reading folder…" all the way through "Writing your
						// profile…". Priority: inference > ingest, since
						// inference auto-fires after ingest and we want the
						// transition to be smooth.
						if (inferenceRunning) {
							return (
								<div className="progress-card">
									<div className="progress-card-row">
										<span className="spinner spinner-blue" />
										<strong>{phaseHeadline()}</strong>
									</div>
									<div className="progress-caption">{captions[captionIdx % captions.length]}</div>
									{profile?.inferenceSignalCount ? (
										<div className="progress-meta">
											{profile.inferenceSignalCount} signals · keep this popup or close it — we'll
											keep working
										</div>
									) : null}
								</div>
							);
						}
						const activeIngest =
							website.state === "busy"
								? { headline: website.message, caption: "Crawling pages, converting to markdown…" }
								: local.state === "busy"
									? { headline: local.message, caption: "Reading your local folder…" }
									: drive.state === "busy"
										? { headline: drive.message, caption: "Reading your Drive folder…" }
										: gmail.state === "busy"
											? { headline: gmail.message, caption: "Pulling recent emails…" }
											: null;
						if (activeIngest) {
							return (
								<div className="progress-card">
									<div className="progress-card-row">
										<span className="spinner spinner-blue" />
										<strong>{activeIngest.headline}</strong>
									</div>
									<div className="progress-caption">{activeIngest.caption}</div>
								</div>
							);
						}
						return null;
					})()}
					{inferencePhase === "failed" && profile?.inferenceError ? (
						<div className="progress-card progress-card-error">
							<strong>
								{profile?.inferenceKind === "augmentation"
									? "Email augmentation failed"
									: "Document profile failed"}
							</strong>
							<div className="progress-caption">{profile.inferenceError}</div>
						</div>
					) : null}
					{profile && profile.version > 0 ? (
						<div className="profile">
							<h3>Your profile (v{profile.version})</h3>
							{!tabContext.onStartupUtah && website.state === "done" && !inferenceRunning ? (
								<div className="profile-updated">Profile updated.</div>
							) : null}
							{profile.stage ? (
								<span className="chip chip-labeled">stage: {profile.stage}</span>
							) : null}
							{profile.geography ? (
								<span className="chip chip-labeled">geo: {profile.geography}</span>
							) : null}
							{profile.industries.map((tag) => (
								<span className="chip chip-bare" key={`ind-${tag}`}>
									{tag}
								</span>
							))}
							{profile.gaps.map((tag) => (
								<span className="chip chip-gap" key={`gap-${tag}`}>
									<strong>gap:</strong> {tag}
								</span>
							))}
						</div>
					) : null}
					<div className="signed-in-row">
						<span className="signed-in-label">Signed in as</span>
						<span className="signed-in-email">{founder.email}</span>
						<button
							type="button"
							className="link-danger signed-in-disconnect"
							onClick={handleDisconnect}
							disabled={disconnecting}
							title="Delete my profile, signals, and ingest runs from the backend; revoke OAuth at Google; clear local extension state."
						>
							{disconnecting ? "Disconnecting…" : "Disconnect"}
						</button>
					</div>
				</>
			)}
			{error ? <div className="error-message">{error}</div> : null}
			{drivePicker ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: standard modal-backdrop click-to-dismiss pattern
				<div
					className="drive-picker-backdrop"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) setDrivePicker(null);
					}}
				>
					<div className="drive-picker" role="dialog" aria-label="Pick a Drive folder">
						<div className="drive-picker-header">
							<button
								type="button"
								className="drive-picker-back"
								onClick={popDrivePicker}
								disabled={drivePicker.stack.length <= 1 || drivePicker.loading}
								title="Go up"
							>
								←
							</button>
							<div className="drive-picker-crumbs">
								{drivePicker.stack.map((c, i) => (
									<span key={`${c.id}-${i}`}>
										{i > 0 ? <span className="drive-picker-sep">/</span> : null}
										<span
											className={
												i === drivePicker.stack.length - 1
													? "drive-picker-crumb-current"
													: "drive-picker-crumb"
											}
										>
											{c.name}
										</span>
									</span>
								))}
							</div>
							<button
								type="button"
								className="drive-picker-close"
								onClick={() => setDrivePicker(null)}
								title="Cancel"
							>
								×
							</button>
						</div>
						<div className="drive-picker-body">
							{drivePicker.loading ? (
								<div className="drive-picker-empty">
									<span className="spinner" /> Loading folders…
								</div>
							) : drivePicker.error ? (
								<div className="drive-picker-empty drive-picker-error">{drivePicker.error}</div>
							) : drivePicker.folders.length === 0 ? (
								<div className="drive-picker-empty">
									No sub-folders here. Use the button below to ingest this folder's files.
								</div>
							) : (
								drivePicker.folders.map((f) => (
									<button
										key={f.id}
										type="button"
										className="drive-picker-row"
										onClick={() => drillIntoDriveFolder(f)}
									>
										<span className="drive-picker-row-name">
											{f.kind === "sharedDrive" ? "🗄️" : "📂"} {f.name}
										</span>
										<span className="drive-picker-row-arrow">›</span>
									</button>
								))
							)}
						</div>
						{(() => {
							const current = drivePicker.stack[drivePicker.stack.length - 1];
							const atVirtualRoot = current?.id === "drives-root";
							return (
								<div className="drive-picker-footer">
									<button
										type="button"
										className="cta"
										disabled={drivePicker.loading || atVirtualRoot}
										onClick={() => {
											if (current && !atVirtualRoot) pickDriveFolder(current.id);
										}}
									>
										{atVirtualRoot ? "Pick a drive to use" : `Use "${current?.name}"`}
									</button>
								</div>
							);
						})()}
					</div>
				</div>
			) : null}
		</div>
	);
}

async function registerWithToken(
	token: AccessTokenResult,
	apply: {
		setFounder: (founder: ConnectedFounder) => void;
		setProfile: (profile: FounderProfile | null) => void;
		setCounts: (counts: SignalCounts) => void;
		setHosts: (hosts: IngestedHosts) => void;
	},
): Promise<void> {
	const result = await getConvexClient().action(api.startupState.auth.registerFounder, {
		accessToken: token.accessToken,
		connectedScopes: token.grantedScopes ?? undefined,
	});
	await setStorage(StorageKeys.GoogleSub, result.googleSub);
	await setStorage(StorageKeys.Email, result.email);
	await setStorage(StorageKeys.FounderId, result.founderId);
	apply.setFounder({
		googleSub: result.googleSub,
		email: result.email,
		founderId: result.founderId,
	});
	subscribeProfile(result.googleSub, apply.setProfile);
	subscribeCounts(result.googleSub, apply.setCounts);
	subscribeIngestedHosts(result.googleSub, apply.setHosts);
}

function subscribeProfile(googleSub: string, setProfile: (profile: FounderProfile | null) => void) {
	getConvexClient().onUpdate(api.startupState.auth.getFounderByGoogleSub, { googleSub }, (value) =>
		setProfile(value),
	);
}

function subscribeCounts(googleSub: string, setCounts: (counts: SignalCounts) => void) {
	getConvexClient().onUpdate(api.startupState.auth.getFounderSignalCounts, { googleSub }, (value) =>
		setCounts(value),
	);
}

function subscribeIngestedHosts(googleSub: string, setHosts: (hosts: IngestedHosts) => void) {
	getConvexClient().onUpdate(
		api.startupState.auth.getFounderIngestedHosts,
		{ googleSub },
		(value) => setHosts(value),
	);
}
