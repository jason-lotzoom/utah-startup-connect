import { ConvexClient } from "convex/browser";

declare const __CONVEX_URL__: string;

let _client: ConvexClient | null = null;

export function getConvexClient(): ConvexClient {
	if (!_client) {
		_client = new ConvexClient(__CONVEX_URL__);
	}
	return _client;
}
