/**
 * Background service worker.
 *
 * Heavy lifting (OAuth flow, ingest actions, inference) happens in the popup,
 * which has direct access to chrome.identity and the Convex client. The SW
 * relays two requests from the content script:
 *   - founderNavigator/getIdentity     → persisted googleSub + email + founderId
 *   - founderNavigator/getAccessToken  → fresh OAuth access_token via
 *                                        chrome.identity.getAuthToken
 *
 * Content scripts can't call chrome.identity directly (extension-only API), so
 * the SW is the bridge.
 */

import { getStorage, StorageKeys } from "../lib/storage";

chrome.runtime.onInstalled.addListener(() => {
	console.log("[founder-navigator] installed");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type === "founderNavigator/getIdentity") {
		(async () => {
			const googleSub = await getStorage<string>(StorageKeys.GoogleSub);
			const email = await getStorage<string>(StorageKeys.Email);
			const founderId = await getStorage<string>(StorageKeys.FounderId);
			sendResponse({ googleSub, email, founderId });
		})();
		return true;
	}
	if (message?.type === "founderNavigator/getAccessToken") {
		try {
			chrome.identity.getAuthToken({ interactive: false }, (rawResult) => {
				const lastError = chrome.runtime.lastError;
				if (lastError || !rawResult) {
					sendResponse({ accessToken: null, error: lastError?.message ?? null });
					return;
				}
				const result = rawResult as string | { token?: string };
				const token = typeof result === "string" ? result : result.token;
				sendResponse({ accessToken: token ?? null });
			});
			return true;
		} catch (err) {
			sendResponse({
				accessToken: null,
				error: err instanceof Error ? err.message : "unknown",
			});
			return false;
		}
	}
	return false;
});
