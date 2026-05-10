/**
 * Thin chrome.storage.local wrapper for the founder-navigator extension.
 * The popup, background SW, and content script all read/write the same
 * keys, so centralize key constants here.
 */

export const StorageKeys = {
	GoogleSub: "founderGoogleSub",
	Email: "founderEmail",
	FounderId: "founderId",
	GmailLastSweepAt: "gmailLastSweepAt",
	DriveLastSweepAt: "driveLastSweepAt",
	LocalLastSweepAt: "localLastSweepAt",
	/**
	 * Last-known profile/counts snapshot. Lets the popup and content
	 * script render the connected UI from cache while Convex subscriptions
	 * warm up on slow connections, instead of flashing the unauthenticated
	 * or no-profile state.
	 */
	CachedSnapshot: "cachedSnapshot",
} as const;

export async function getStorage<T = unknown>(key: string): Promise<T | undefined> {
	const result = await chrome.storage.local.get(key);
	return result[key] as T | undefined;
}

export async function setStorage(key: string, value: unknown): Promise<void> {
	await chrome.storage.local.set({ [key]: value });
}

export async function clearStorage(...keys: string[]): Promise<void> {
	if (keys.length === 0) {
		await chrome.storage.local.clear();
		return;
	}
	await chrome.storage.local.remove(keys);
}
