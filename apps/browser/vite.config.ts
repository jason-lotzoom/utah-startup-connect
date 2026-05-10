import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

/**
 * Resolve the Convex deployment URL for the popup + content-script bundles.
 *
 * Priority:
 *   1. `.env.local` `CONVEX_URL`   ← worktree-isolated, written by scripts/worktree.ts
 *   2. `.env`       `CONVEX_URL`
 *   3. `CONVEX_DEPLOYMENT` env var (parses `dev:<name>` → `https://<name>.convex.cloud`)
 *   4. `VITE_CONVEX_URL` env var
 *   5. shell `CONVEX_URL` env var ← LAST because it can be stale across worktrees
 *   6. error
 *
 * Shell `CONVEX_URL` is intentionally last: a sibling worktree leaves it set,
 * which would make this build silently target the wrong deployment.
 */
function readEnvVar(filename: string, key: string): string | undefined {
	const path = resolve(__dirname, "../../", filename);
	if (!existsSync(path)) return undefined;
	const content = readFileSync(path, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const k = trimmed.slice(0, eq).trim();
		if (k === key) {
			return trimmed
				.slice(eq + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
		}
	}
	return undefined;
}

function deploymentUrlFromName(deployment: string | undefined): string | undefined {
	if (!deployment) return undefined;
	const name = deployment.includes(":") ? deployment.split(":", 2)[1] : deployment;
	if (!name) return undefined;
	return `https://${name}.convex.cloud`;
}

function resolveConvexUrl(): string {
	const fromLocal = readEnvVar(".env.local", "CONVEX_URL");
	if (fromLocal) return fromLocal;

	const fromRoot = readEnvVar(".env", "CONVEX_URL");
	if (fromRoot) return fromRoot;

	const deploymentLocal = readEnvVar(".env.local", "CONVEX_DEPLOYMENT");
	const fromLocalDeployment = deploymentUrlFromName(deploymentLocal);
	if (fromLocalDeployment) return fromLocalDeployment;

	const deploymentShell = process.env.CONVEX_DEPLOYMENT;
	const fromShellDeployment = deploymentUrlFromName(deploymentShell);
	if (fromShellDeployment) return fromShellDeployment;

	const shell = process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL;
	if (shell) return shell;

	throw new Error(
		"CONVEX_URL not resolvable. Run `bun scripts/worktree.ts` (writes .env.local) or export CONVEX_DEPLOYMENT=dev:<name>.",
	);
}

const CONVEX_URL = resolveConvexUrl();
console.log(`[apps/browser] CONVEX_URL = ${CONVEX_URL}`);

export default defineConfig({
	plugins: [react(), crx({ manifest })],
	server: {
		port: 5173,
		strictPort: true,
		hmr: { port: 5173 },
		// MV3 service workers run from `chrome-extension://<id>` and import
		// `@vite/env` (and other dev modules) from this server. Without an
		// explicit allow-list the browser blocks the request as cross-origin
		// and the SW registration fails ("Status code: 3"). Allow any
		// extension origin in dev only — the CORS allowlist isn't shipped.
		cors: { origin: /chrome-extension:\/\/.+/ },
	},
	build: {
		emptyOutDir: true,
		outDir: "dist",
		sourcemap: true,
	},
	define: {
		__CONVEX_URL__: JSON.stringify(CONVEX_URL),
	},
});
