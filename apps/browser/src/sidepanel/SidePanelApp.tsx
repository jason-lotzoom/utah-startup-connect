/**
 * Side panel — file-tree view of artifacts ingested for the signed-in
 * founder. Two top-level groups: Drive folders + the founder's local
 * files. Local files are nested by sub-directory so a path like
 * `vault/offers/broker-x.md` renders as
 * `Lotzoom Local Files > offers > broker-x.md`.
 *
 * Gmail signals are intentionally excluded — they aren't files. Gmail
 * ingest counts still drive flyout citations, but they don't show up in
 * this file tree.
 *
 * Clicking a local file expands an inline content preview (lazy-loaded
 * via `getIngestedSignalContent`) since extension pages can't open
 * `file://` URLs and the File System Access API doesn't expose absolute
 * paths.
 */

import type { FunctionReturnType } from "convex/server";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "../lib/convexClient";
import { getStorage, StorageKeys } from "../lib/storage";

type Signal = FunctionReturnType<typeof api.startupState.auth.listIngestedSignals>[number];
type SignalContent = NonNullable<
	FunctionReturnType<typeof api.startupState.auth.getIngestedSignalContent>
>;
type FileSource = "drive" | "local";

const UNGROUPED_KEY = "__ungrouped__";

const PERSONAL_EMAIL_DOMAINS = new Set([
	"gmail.com",
	"yahoo.com",
	"hotmail.com",
	"outlook.com",
	"icloud.com",
	"me.com",
	"mac.com",
	"aol.com",
	"protonmail.com",
	"proton.me",
	"live.com",
	"msn.com",
	"ymail.com",
	"fastmail.com",
	"fastmail.fm",
	"hey.com",
	"duck.com",
]);

/**
 * Branded label for the founder's local files. If the email domain looks
 * like a personal email host (gmail/yahoo/etc.) we fall back to a generic
 * "Founder's Local Files". Otherwise we capitalize the second-level
 * domain — `jason@lotzoom.com` → `Lotzoom Local Files`.
 */
function brandedLocalLabel(email: string | null): string {
	if (!email) return "Founder's Local Files";
	const parts = email.split("@");
	const domain = parts[1]?.toLowerCase();
	if (!domain) return "Founder's Local Files";
	if (PERSONAL_EMAIL_DOMAINS.has(domain)) return "Founder's Local Files";
	const stem = domain.split(".")[0];
	if (!stem) return "Founder's Local Files";
	return `${stem.charAt(0).toUpperCase()}${stem.slice(1)} Local Files`;
}

interface DirNode {
	name: string;
	fullPath: string;
	dirs: Map<string, DirNode>;
	files: Signal[];
}

function emptyDir(name: string, fullPath: string): DirNode {
	return { name, fullPath, dirs: new Map(), files: [] };
}

/**
 * For a list of files within a single picked container, build a directory
 * tree from `relativePath` parts. The displayed path is derived by
 * stripping the leading `containerName/` from the signal title.
 */
function buildDirTree(files: Signal[], containerName: string | null): DirNode {
	const root = emptyDir("/", "");
	for (const file of files) {
		const rel = relativeWithinContainer(file, containerName);
		const parts = rel.split("/").filter((p) => p.length > 0);
		if (parts.length === 0) {
			root.files.push(file);
			continue;
		}
		let cursor = root;
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			const path = parts.slice(0, i + 1).join("/");
			let child = cursor.dirs.get(part);
			if (!child) {
				child = emptyDir(part, path);
				cursor.dirs.set(part, child);
			}
			cursor = child;
		}
		cursor.files.push(file);
	}
	return root;
}

function relativeWithinContainer(file: Signal, containerName: string | null): string {
	const title = file.title;
	if (containerName && title.startsWith(`${containerName}/`)) {
		return title.slice(containerName.length + 1);
	}
	return title;
}

interface SourceGroup {
	total: number;
	containers: Map<string, Signal[]>;
}

function groupSignals(
	signals: Array<Signal & { source: FileSource }>,
): Map<FileSource, SourceGroup> {
	const order: readonly FileSource[] = ["drive", "local"];
	const out = new Map<FileSource, SourceGroup>();
	for (const source of order) {
		out.set(source, { total: 0, containers: new Map() });
	}
	for (const signal of signals) {
		const group = out.get(signal.source);
		if (!group) continue;
		group.total++;
		const key = signal.containerName ?? UNGROUPED_KEY;
		if (!group.containers.has(key)) group.containers.set(key, []);
		group.containers.get(key)?.push(signal);
	}
	for (const group of out.values()) {
		for (const files of group.containers.values()) {
			files.sort((a, b) => a.title.localeCompare(b.title));
		}
	}
	return out;
}

export function SidePanelApp(): ReactElement {
	const [googleSub, setGoogleSub] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [signals, setSignals] = useState<Signal[]>([]);
	const [openSources, setOpenSources] = useState<Set<FileSource> | null>(null);
	const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
	const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
	const [contents, setContents] = useState<Map<string, SignalContent | "loading" | "error">>(
		new Map(),
	);
	const fetchedRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		(async () => {
			const sub = await getStorage<string>(StorageKeys.GoogleSub);
			const em = await getStorage<string>(StorageKeys.Email);
			if (sub) setGoogleSub(sub);
			if (em) setEmail(em);
		})();

		const onChange = (
			changes: Record<string, chrome.storage.StorageChange>,
			areaName: chrome.storage.AreaName,
		) => {
			if (areaName !== "local") return;
			if (StorageKeys.GoogleSub in changes) {
				setGoogleSub((changes[StorageKeys.GoogleSub]?.newValue as string | undefined) ?? null);
			}
			if (StorageKeys.Email in changes) {
				setEmail((changes[StorageKeys.Email]?.newValue as string | undefined) ?? null);
			}
		};
		chrome.storage.onChanged.addListener(onChange);
		return () => chrome.storage.onChanged.removeListener(onChange);
	}, []);

	useEffect(() => {
		if (!googleSub) {
			setSignals([]);
			return;
		}
		const unsubscribe = getConvexClient().onUpdate(
			api.startupState.auth.listIngestedSignals,
			{ googleSub },
			(rows) => setSignals(rows),
		);
		return unsubscribe;
	}, [googleSub]);

	const fileSignals = useMemo(
		() => signals.filter((s): s is Signal & { source: FileSource } => s.source !== "gmail"),
		[signals],
	);
	const grouped = useMemo(() => groupSignals(fileSignals), [fileSignals]);

	const localLabel = useMemo(() => brandedLocalLabel(email), [email]);
	const sourceLabel = (source: FileSource): string =>
		source === "drive" ? "Drive folders" : localLabel;

	useEffect(() => {
		if (openSources !== null) return;
		if (signals.length === 0) return;
		const driveCount = grouped.get("drive")?.total ?? 0;
		const localCount = grouped.get("local")?.total ?? 0;
		const initial = new Set<FileSource>();
		// Drive expands by default if it has files. Local expands by default
		// only if there are no drive folders linked.
		if (driveCount > 0) initial.add("drive");
		if (localCount > 0 && driveCount === 0) initial.add("local");
		setOpenSources(initial);
	}, [signals.length, grouped, openSources]);

	const toggleSource = (source: FileSource) => {
		setOpenSources((prev) => {
			const base = prev ?? new Set<FileSource>();
			const next = new Set(base);
			if (next.has(source)) next.delete(source);
			else next.add(source);
			return next;
		});
	};

	const toggleDir = (key: string) => {
		setOpenDirs((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	async function toggleFile(file: Signal) {
		const id = file._id;
		const wasOpen = openFiles.has(id);
		setOpenFiles((prev) => {
			const next = new Set(prev);
			if (wasOpen) next.delete(id);
			else next.add(id);
			return next;
		});
		if (wasOpen) return;
		if (fetchedRef.current.has(id)) return;
		if (!googleSub) return;
		fetchedRef.current.add(id);
		setContents((prev) => {
			const next = new Map(prev);
			next.set(id, "loading");
			return next;
		});
		try {
			const result = await getConvexClient().query(api.startupState.auth.getIngestedSignalContent, {
				googleSub,
				signalId: file._id,
			});
			setContents((prev) => {
				const next = new Map(prev);
				next.set(id, result ?? "error");
				return next;
			});
		} catch {
			setContents((prev) => {
				const next = new Map(prev);
				next.set(id, "error");
				return next;
			});
		}
	}

	if (!googleSub) {
		return (
			<div className="root">
				<div className="title-row">
					<img
						src={chrome.runtime.getURL("icon-64.png")}
						alt=""
						className="brand-icon"
						width={26}
						height={26}
					/>
					<h1 className="title">Files</h1>
				</div>
				<p className="empty">
					Open the extension popup and click Connect Google to see your ingested files here.
				</p>
			</div>
		);
	}

	if (fileSignals.length === 0) {
		return (
			<div className="root">
				<div className="title-row">
					<img
						src={chrome.runtime.getURL("icon-64.png")}
						alt=""
						className="brand-icon"
						width={26}
						height={26}
					/>
					<h1 className="title">Files</h1>
				</div>
				<p className="subtitle">No files ingested yet.</p>
				<p className="empty">
					In the popup, click <strong>Pick folder</strong> for Drive or Local to populate this tree.
					(Gmail messages aren't files and are excluded from this view.)
				</p>
			</div>
		);
	}

	const effectiveOpenSources = openSources ?? new Set<FileSource>(["drive", "local"]);
	const order: readonly FileSource[] = ["drive", "local"];

	return (
		<div className="root">
			<h1 className="title">Files</h1>
			<p className="subtitle">
				{fileSignals.length} file{fileSignals.length === 1 ? "" : "s"} · grouped by source and
				folder
			</p>
			{order.map((source) => {
				const sourceGroup = grouped.get(source);
				if (!sourceGroup || sourceGroup.total === 0) return null;
				const isOpen = effectiveOpenSources.has(source);
				return (
					<div className="source-group" key={source}>
						<button type="button" className="source-header" onClick={() => toggleSource(source)}>
							<span>
								<span className="arrow" style={{ marginRight: 8 }}>
									{isOpen ? "▾" : "▸"}
								</span>
								{sourceLabel(source)}
							</span>
							<span className="count">{sourceGroup.total}</span>
						</button>
						{isOpen ? (
							<div className="source-body">
								{Array.from(sourceGroup.containers.entries()).map(([containerKey, files]) => {
									const containerLabelText =
										containerKey === UNGROUPED_KEY
											? source === "local"
												? localLabel
												: "(unknown folder)"
											: containerKey;
									const groupKey = `${source}::${containerKey}`;
									const isContainerOpen = openDirs.has(groupKey);
									if (source === "drive") {
										return (
											<div className="container-group" key={groupKey}>
												<button
													type="button"
													className="container-header"
													onClick={() => toggleDir(groupKey)}
												>
													<span className={`arrow ${isContainerOpen ? "open" : ""}`}>▸</span>
													<span>📁 {containerLabelText}</span>
													<span className="container-count">{files.length}</span>
												</button>
												{isContainerOpen
													? renderFlatFiles(files, openFiles, contents, toggleFile)
													: null}
											</div>
										);
									}
									// local source — render as a recursive directory tree.
									const containerName = containerKey === UNGROUPED_KEY ? null : containerKey;
									const tree = buildDirTree(files, containerName);
									return (
										<div className="container-group" key={groupKey}>
											<button
												type="button"
												className="container-header"
												onClick={() => toggleDir(groupKey)}
											>
												<span className={`arrow ${isContainerOpen ? "open" : ""}`}>▸</span>
												<span>📁 {containerLabelText}</span>
												<span className="container-count">{files.length}</span>
											</button>
											{isContainerOpen ? (
												<DirView
													node={tree}
													keyPrefix={groupKey}
													openDirs={openDirs}
													toggleDir={toggleDir}
													openFiles={openFiles}
													contents={contents}
													toggleFile={toggleFile}
												/>
											) : null}
										</div>
									);
								})}
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

/**
 * Recursive directory renderer for local-files trees. Sub-directories are
 * collapsed by default to keep the panel quiet on first open.
 */
function DirView(props: {
	node: DirNode;
	keyPrefix: string;
	openDirs: Set<string>;
	toggleDir: (key: string) => void;
	openFiles: Set<string>;
	contents: Map<string, SignalContent | "loading" | "error">;
	toggleFile: (file: Signal) => void;
}): ReactElement {
	const { node, keyPrefix, openDirs, toggleDir, openFiles, contents, toggleFile } = props;
	const subdirs = Array.from(node.dirs.values()).sort((a, b) => a.name.localeCompare(b.name));
	const sortedFiles = [...node.files].sort((a, b) => a.title.localeCompare(b.title));
	return (
		<div className="dir-body">
			{subdirs.map((sub) => {
				const dirKey = `${keyPrefix}::${sub.fullPath}`;
				const isOpen = openDirs.has(dirKey);
				const fileCount = countFilesIn(sub);
				return (
					<div className="dir-group" key={dirKey}>
						<button type="button" className="dir-header" onClick={() => toggleDir(dirKey)}>
							<span className={`arrow ${isOpen ? "open" : ""}`}>▸</span>
							<span>📂 {sub.name}</span>
							<span className="dir-count">{fileCount}</span>
						</button>
						{isOpen ? (
							<DirView
								node={sub}
								keyPrefix={dirKey}
								openDirs={openDirs}
								toggleDir={toggleDir}
								openFiles={openFiles}
								contents={contents}
								toggleFile={toggleFile}
							/>
						) : null}
					</div>
				);
			})}
			{sortedFiles.length > 0
				? renderFlatFiles(sortedFiles, openFiles, contents, toggleFile, true)
				: null}
		</div>
	);
}

function countFilesIn(node: DirNode): number {
	let count = node.files.length;
	for (const sub of node.dirs.values()) count += countFilesIn(sub);
	return count;
}

/**
 * Render a flat list of file rows. For non-local sources the row is a
 * link (Drive opens drive.google.com, Gmail would open the thread).
 * For local files the row is a click-to-expand button that lazy-loads
 * content via `toggleFile` and renders a `<pre>` preview.
 */
function renderFlatFiles(
	files: Signal[],
	openFiles: Set<string>,
	contents: Map<string, SignalContent | "loading" | "error">,
	toggleFile: (file: Signal) => void,
	insideTree = false,
): ReactElement {
	return (
		<ul className={insideTree ? "file-list nested" : "file-list"}>
			{files.map((file) => {
				const leaf = leafName(file);
				if (file.source === "local") {
					const isOpen = openFiles.has(file._id);
					const content = contents.get(file._id);
					return (
						<li className="file-row local" key={file._id}>
							<button
								type="button"
								className="file-button"
								onClick={() => toggleFile(file)}
								title={file.title}
							>
								<span className={`arrow ${isOpen ? "open" : ""}`}>▸</span>
								<span className="file-icon">📄</span>
								<span className="file-name">{leaf}</span>
							</button>
							{isOpen ? <div className="file-preview">{renderPreview(content, file)}</div> : null}
						</li>
					);
				}
				return (
					<li className="file-row" key={file._id}>
						<span className="file-icon">📄</span>
						{file.uri ? (
							<a href={file.uri} target="_blank" rel="noreferrer" title={file.title}>
								{leaf}
							</a>
						) : (
							<span title={file.title}>{leaf}</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}

function renderPreview(
	content: SignalContent | "loading" | "error" | undefined,
	file: Signal,
): ReactElement {
	if (content === undefined || content === "loading") {
		return <div className="file-preview-status">Loading…</div>;
	}
	if (content === "error") {
		return <div className="file-preview-status error">Could not load file content.</div>;
	}
	const text =
		content.extractedText.length > 50_000
			? `${content.extractedText.slice(0, 50_000)}\n\n… (truncated)`
			: content.extractedText;
	return (
		<>
			<div className="file-preview-meta">
				{relativeWithinContainer(file, content.containerName) || file.title}
			</div>
			<pre className="file-preview-body">{text}</pre>
		</>
	);
}

function leafName(signal: Signal): string {
	if (signal.source !== "local") return signal.title;
	const rel = relativeWithinContainer(signal, signal.containerName);
	const parts = rel.split("/");
	return parts[parts.length - 1] ?? rel;
}
