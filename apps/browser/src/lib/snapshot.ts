/**
 * Optimistic UI snapshot persisted to `chrome.storage.local`.
 *
 * Both the popup and the content script read this on startup so they can
 * paint the connected UI immediately, then let live Convex subscriptions
 * overwrite when the network round-trip resolves. Without this cache, slow
 * connections briefly show the unauthenticated / no-profile state before
 * the live data lands — a misleading flash.
 *
 * Shape mirrors the union of what both surfaces need:
 *   - `profile`   — the founder's most recent profile doc (used by both).
 *   - `counts`    — popup-only signal counts (content script ignores).
 *   - `ingestedHosts` — popup-only website list.
 *   - `savedAt`   — wall-clock timestamp; useful for cache-staleness
 *                   debugging only, not for invalidation.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { getStorage, setStorage, StorageKeys } from "./storage";

type FounderProfile = NonNullable<
	FunctionReturnType<typeof api.startupState.auth.getFounderByGoogleSub>
>;
type SignalCounts = FunctionReturnType<typeof api.startupState.auth.getFounderSignalCounts>;
type IngestedHosts = FunctionReturnType<typeof api.startupState.auth.getFounderIngestedHosts>;

export interface CachedSnapshot {
	profile: FounderProfile | null;
	counts: SignalCounts | null;
	ingestedHosts: IngestedHosts;
	savedAt: number;
}

export async function readCachedSnapshot(): Promise<CachedSnapshot | undefined> {
	return await getStorage<CachedSnapshot>(StorageKeys.CachedSnapshot);
}

export async function writeCachedSnapshot(snapshot: CachedSnapshot): Promise<void> {
	await setStorage(StorageKeys.CachedSnapshot, snapshot);
}

export async function clearCachedSnapshot(): Promise<void> {
	await setStorage(StorageKeys.CachedSnapshot, null);
}
