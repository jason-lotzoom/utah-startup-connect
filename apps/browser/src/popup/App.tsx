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
import { clearAccessTokenCache, getAccessToken } from "../auth/identity";
import { extractFolderId } from "../ingest/drive";
import { pickAndReadFolder } from "../ingest/local";
import { getConvexClient } from "../lib/convexClient";
import { getStorage, StorageKeys, setStorage } from "../lib/storage";

type SourceState = "idle" | "busy" | "done" | "error";

interface SourceStatus {
	state: SourceState;
	message: string;
}

const initialSource: SourceStatus = { state: "idle", message: "Not connected" };

interface ConnectedFounder {
	googleSub: string;
	email: string;
	founderId: string;
}

type FounderProfile = NonNullable<
	FunctionReturnType<typeof api.startupState.auth.getFounderByGoogleSub>
>;

type SignalCounts = FunctionReturnType<typeof api.startupState.auth.getFounderSignalCounts>;

const ZERO_COUNTS: SignalCounts = { founderId: null, gmail: 0, drive: 0, local: 0 };

export function App() {
	const [error, setError] = useState<string | null>(null);
	const [connecting, setConnecting] = useState(false);
	const [founder, setFounder] = useState<ConnectedFounder | null>(null);
	const [profile, setProfile] = useState<FounderProfile | null>(null);
	const [counts, setCounts] = useState<SignalCounts>(ZERO_COUNTS);
	const [gmail, setGmail] = useState<SourceStatus>(initialSource);
	const [drive, setDrive] = useState<SourceStatus>(initialSource);
	const [local, setLocal] = useState<SourceStatus>(initialSource);
	const [inferring, setInferring] = useState(false);

	useEffect(() => {
		(async () => {
			const sub = await getStorage<string>(StorageKeys.GoogleSub);
			const email = await getStorage<string>(StorageKeys.Email);
			const founderId = await getStorage<string>(StorageKeys.FounderId);
			if (sub && email && founderId) {
				setFounder({ googleSub: sub, email, founderId });
				subscribeProfile(sub, setProfile);
				subscribeCounts(sub, setCounts);
			}
		})();
	}, []);

	async function handleConnect() {
		setError(null);
		setConnecting(true);
		try {
			const token = await getAccessToken(true);
			if (!token) throw new Error("Sign-in cancelled");
			const client = getConvexClient();
			const result = await client.action(api.startupState.auth.registerFounder, {
				accessToken: token.accessToken,
				connectedScopes: token.grantedScopes ?? undefined,
			});
			await setStorage(StorageKeys.GoogleSub, result.googleSub);
			await setStorage(StorageKeys.Email, result.email);
			await setStorage(StorageKeys.FounderId, result.founderId);
			setFounder({
				googleSub: result.googleSub,
				email: result.email,
				founderId: result.founderId,
			});
			subscribeProfile(result.googleSub, setProfile);
			subscribeCounts(result.googleSub, setCounts);
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

	async function handleSweepGmail() {
		setError(null);
		setGmail({ state: "busy", message: "Ingesting…" });
		try {
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.sweepGmail, {
					accessToken,
					maxResults: 100,
				}),
			);
			setGmail({
				state: "done",
				message: `Ingested ${result.ingested} (${result.deduped} dup, ${result.skipped} skip)`,
			});
		} catch (err) {
			setGmail({
				state: "error",
				message: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	async function handleSweepDrive() {
		setError(null);
		const input = window.prompt("Paste a Google Drive folder URL or ID:", "");
		if (!input) return;
		const folderId = extractFolderId(input);
		if (!folderId) {
			setDrive({ state: "error", message: "Could not parse folder ID" });
			return;
		}
		setDrive({ state: "busy", message: "Ingesting…" });
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
		} catch (err) {
			setDrive({
				state: "error",
				message: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	async function handleSweepLocal() {
		setError(null);
		setLocal({ state: "busy", message: "Reading folder…" });
		try {
			const files = await pickAndReadFolder();
			const result = await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.ingest.writeLocalSignals, {
					accessToken,
					files,
				}),
			);
			setLocal({
				state: "done",
				message: `Ingested ${result.ingested} files (${result.skipped} skipped)`,
			});
		} catch (err) {
			setLocal({
				state: "error",
				message: err instanceof Error ? err.message : "Failed",
			});
		}
	}

	async function handleRunInference() {
		setError(null);
		setInferring(true);
		try {
			await withFreshToken((accessToken) =>
				getConvexClient().action(api.startupState.profile.runInference, { accessToken }),
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Inference failed");
		} finally {
			setInferring(false);
		}
	}

	function pillClass(state: SourceState): string {
		if (state === "done") return "pill success";
		if (state === "busy") return "pill busy";
		if (state === "error") return "pill error";
		return "pill";
	}

	/**
	 * Derive the pill text/style for one signal source. Priority:
	 *   1. Live action state (busy/error/done) — this run's status wins.
	 *   2. Persisted DB counts — surface "N ingested" so a fresh popup
	 *      mount doesn't lie to the user with "Not connected".
	 *   3. Idle/empty fallback.
	 */
	function pillFor(status: SourceStatus, count: number): { className: string; text: string } {
		if (status.state !== "idle") {
			return { className: pillClass(status.state), text: status.message };
		}
		if (count > 0) return { className: "pill success", text: `${count} ingested` };
		return { className: "pill", text: "Not connected" };
	}

	return (
		<div className="root">
			<h1 className="title">Founder Navigator</h1>
			<p className="subtitle">Personalize startup.utah.gov to your business.</p>
			{!founder ? (
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
					<div className="row">
						<div>
							<div className="label">Signed in</div>
							<div className="pill">{founder.email}</div>
						</div>
					</div>
					{(() => {
						const gmailPill = pillFor(gmail, counts.gmail);
						const drivePill = pillFor(drive, counts.drive);
						const localPill = pillFor(local, counts.local);
						return (
							<>
								<div className="row">
									<div className="label">Gmail</div>
									<div style={{ display: "flex", alignItems: "center" }}>
										<span className={gmailPill.className}>{gmailPill.text}</span>
										<button
											type="button"
											disabled={gmail.state === "busy"}
											onClick={handleSweepGmail}
										>
											Sweep
										</button>
									</div>
								</div>
								<div className="row">
									<div className="label">Drive folder</div>
									<div style={{ display: "flex", alignItems: "center" }}>
										<span className={drivePill.className}>{drivePill.text}</span>
										<button
											type="button"
											disabled={drive.state === "busy"}
											onClick={handleSweepDrive}
										>
											Pick folder
										</button>
									</div>
								</div>
								<div className="row">
									<div className="label">Local folder</div>
									<div style={{ display: "flex", alignItems: "center" }}>
										<span className={localPill.className}>{localPill.text}</span>
										<button
											type="button"
											disabled={local.state === "busy"}
											onClick={handleSweepLocal}
										>
											Pick folder
										</button>
									</div>
								</div>
							</>
						);
					})()}
					<button
						type="button"
						className="cta"
						onClick={handleRunInference}
						disabled={inferring}
						style={{ marginTop: 12 }}
					>
						{inferring ? "Inferring profile…" : "Build / refresh profile"}
					</button>
					{profile && profile.version > 0 ? (
						<div className="profile">
							<h3>Your profile (v{profile.version})</h3>
							{profile.stage ? <span className="chip">stage: {profile.stage}</span> : null}
							{profile.geography ? <span className="chip">geo: {profile.geography}</span> : null}
							{profile.industries.map((tag) => (
								<span className="chip" key={`ind-${tag}`}>
									{tag}
								</span>
							))}
							{profile.gaps.map((tag) => (
								<span className="chip" key={`gap-${tag}`}>
									gap: {tag}
								</span>
							))}
							<p className="note">
								Visit startup.utah.gov to see relevance badges + gap-analysis strip.
							</p>
						</div>
					) : null}
				</>
			)}
			{error ? <div className="error-message">{error}</div> : null}
		</div>
	);
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
