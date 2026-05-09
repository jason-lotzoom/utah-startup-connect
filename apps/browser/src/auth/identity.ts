/**
 * chrome.identity wrapper. Returns an OAuth access_token granted with the
 * scopes declared in `manifest.json` `oauth2.scopes`. The Convex backend
 * verifies the token via Google's `/userinfo` endpoint, so the popup only
 * needs to forward the access token.
 */

export interface AccessTokenResult {
	accessToken: string;
	grantedScopes: string[] | null;
}

interface ChromeAuthTokenObject {
	token?: string;
	grantedScopes?: string[];
}

export function getAccessToken(interactive: boolean): Promise<AccessTokenResult | null> {
	return new Promise((resolve, reject) => {
		try {
			chrome.identity.getAuthToken({ interactive }, (rawResult) => {
				const lastError = chrome.runtime.lastError;
				if (lastError || !rawResult) {
					if (interactive) reject(new Error(lastError?.message ?? "OAuth flow returned no token"));
					else resolve(null);
					return;
				}
				const result = rawResult as string | ChromeAuthTokenObject;
				const token = typeof result === "string" ? result : result.token;
				const grantedScopes = typeof result === "string" ? null : (result.grantedScopes ?? null);
				if (!token) {
					resolve(null);
					return;
				}
				resolve({ accessToken: token, grantedScopes });
			});
		} catch (err) {
			reject(err);
		}
	});
}

export function clearAccessTokenCache(token: string): Promise<void> {
	return new Promise((resolve) => {
		chrome.identity.removeCachedAuthToken({ token }, () => resolve());
	});
}
