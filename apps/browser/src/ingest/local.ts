/**
 * Local-folder ingestion via the File System Access API.
 *
 * The popup invokes `pickAndReadFolder()` which opens the directory picker,
 * walks the tree (recursively by default), extracts text from supported MIME
 * types, and returns an array shaped for the
 * `startupState/ingest:writeLocalSignals` action.
 */

const MAX_FILES = 250;
/**
 * 512 KB is plenty for the kinds of textual documents that yield real
 * profile signal — README files, founder notes, financial CSVs,
 * pitch-deck markdown, etc. Anything larger is almost always either a
 * data dump (noise) or a binary masquerading as text.
 */
const MAX_BYTES_PER_FILE = 512 * 1024;
const MAX_DEPTH = 8;

/**
 * Allowlist of textual document extensions we'll attempt to ingest.
 * Picked for "low-hanging fruit" business / planning documents — not
 * source code, configs, or build artifacts.
 */
const SUPPORTED_EXTENSIONS = new Set([
	// plain prose
	".txt",
	".text",
	".md",
	".markdown",
	".rst",
	".org",
	".log",
	".rtf",
	// structured data
	".csv",
	".tsv",
	".json",
	".jsonl",
	".ndjson",
	".yaml",
	".yml",
	".toml",
	".xml",
	// web
	".html",
	".htm",
	// subtitles / transcripts
	".srt",
	".vtt",
	// email
	".eml",
	// config text
	".ini",
	".conf",
	".cfg",
]);

/**
 * Even if a file's MIME type registers as text/* (e.g. text/javascript),
 * extensions in this set are excluded — they're code or binary noise we
 * don't want polluting the founder's document corpus.
 */
const BLOCKED_EXTENSIONS = new Set([
	// source code
	".js",
	".jsx",
	".mjs",
	".cjs",
	".ts",
	".tsx",
	".py",
	".rb",
	".go",
	".java",
	".c",
	".cc",
	".cpp",
	".cxx",
	".h",
	".hpp",
	".cs",
	".swift",
	".kt",
	".kts",
	".rs",
	".php",
	".lua",
	".scala",
	".clj",
	".cljs",
	".ex",
	".exs",
	".erl",
	".hs",
	".ml",
	".nim",
	".dart",
	".vue",
	".svelte",
	".sql",
	".r",
	".jl",
	// shell / windows
	".sh",
	".bash",
	".zsh",
	".fish",
	".ps1",
	".bat",
	".cmd",
	".pl",
	".vbs",
	// images
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".bmp",
	".ico",
	".tiff",
	".heic",
	".avif",
	// archives
	".zip",
	".tar",
	".gz",
	".tgz",
	".bz2",
	".7z",
	".rar",
	".xz",
	".lz",
	".lzma",
	// media
	".mp3",
	".mp4",
	".wav",
	".ogg",
	".flac",
	".avi",
	".mov",
	".mkv",
	".webm",
	".m4a",
	".m4v",
	".aac",
	".opus",
	// binaries / installers
	".exe",
	".dmg",
	".iso",
	".pkg",
	".msi",
	".deb",
	".rpm",
	".app",
	".bin",
	".so",
	".dylib",
	".dll",
	".o",
	".a",
	// office (we can't parse these without a backend extractor)
	".doc",
	".docx",
	".xls",
	".xlsx",
	".ppt",
	".pptx",
	".odt",
	".ods",
	".odp",
	".pdf",
	// fonts
	".ttf",
	".otf",
	".woff",
	".woff2",
	".eot",
	// editor temp / backup
	".swp",
	".swo",
	".bak",
	".tmp",
	".lock",
]);

/** Skip these directory names entirely — almost always noise. */
const EXCLUDED_DIR_NAMES = new Set([
	".git",
	".svn",
	".hg",
	"node_modules",
	".next",
	".turbo",
	".vercel",
	".cache",
	"dist",
	"build",
	"out",
	".DS_Store",
	"__pycache__",
	".venv",
	".idea",
	".vscode",
]);

export interface LocalSignalUpload {
	relativePath: string;
	mimeType: string;
	extractedText: string;
	skippedReason?: string;
	folderName?: string;
}

export interface LocalIngestOptions {
	/** Walk into subdirectories. Default: true. */
	recursive?: boolean;
}

declare global {
	interface Window {
		showDirectoryPicker?: (options?: {
			id?: string;
			mode?: "read" | "readwrite";
		}) => Promise<FileSystemDirectoryHandle>;
	}
	interface FileSystemDirectoryHandle {
		entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
	}
	interface FileSystemFileHandle {
		getFile: () => Promise<File>;
	}
}

function lastExtension(name: string): string {
	const idx = name.lastIndexOf(".");
	return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function inferMimeType(file: File): string {
	if (file.type) return file.type;
	const ext = lastExtension(file.name);
	if (ext === ".md" || ext === ".markdown") return "text/markdown";
	if (ext === ".txt" || ext === ".text") return "text/plain";
	if (ext === ".csv") return "text/csv";
	if (ext === ".tsv") return "text/tab-separated-values";
	if (ext === ".json" || ext === ".jsonl" || ext === ".ndjson") return "application/json";
	if (ext === ".yaml" || ext === ".yml") return "application/yaml";
	if (ext === ".html" || ext === ".htm") return "text/html";
	if (ext === ".xml") return "application/xml";
	return "application/octet-stream";
}

function isTextExtractable(file: File): boolean {
	const ext = lastExtension(file.name);
	if (ext && BLOCKED_EXTENSIONS.has(ext)) return false;
	if (ext && SUPPORTED_EXTENSIONS.has(ext)) return true;
	// No extension or unfamiliar extension: only accept if the OS
	// reported a `text/*` MIME and it's not one of the script-y ones.
	const mime = file.type;
	if (mime.startsWith("text/")) {
		if (mime === "text/javascript" || mime === "text/typescript") return false;
		return true;
	}
	return false;
}

export async function pickAndReadFolder(
	opts: LocalIngestOptions = {},
): Promise<LocalSignalUpload[]> {
	if (!window.showDirectoryPicker) {
		throw new Error("File System Access API not supported in this browser");
	}
	const dir = await window.showDirectoryPicker({ mode: "read" });
	return readFolderHandle(dir, "", dir.name, opts);
}

export async function readFolderHandle(
	dir: FileSystemDirectoryHandle,
	prefix = "",
	folderName?: string,
	opts: LocalIngestOptions = {},
): Promise<LocalSignalUpload[]> {
	const out: LocalSignalUpload[] = [];
	const recursive = opts.recursive ?? true;
	await walk(dir, prefix, folderName, out, recursive, 0);
	return out;
}

async function walk(
	dir: FileSystemDirectoryHandle,
	prefix: string,
	folderName: string | undefined,
	out: LocalSignalUpload[],
	recursive: boolean,
	depth: number,
): Promise<void> {
	for await (const [name, handle] of dir.entries()) {
		if (out.length >= MAX_FILES) return;
		const relativePath = prefix ? `${prefix}/${name}` : name;

		if (handle.kind === "directory") {
			if (!recursive) continue;
			if (depth >= MAX_DEPTH) continue;
			if (EXCLUDED_DIR_NAMES.has(name)) continue;
			if (name.startsWith(".")) continue;
			await walk(
				handle as FileSystemDirectoryHandle,
				relativePath,
				folderName,
				out,
				recursive,
				depth + 1,
			);
			continue;
		}

		if (handle.kind !== "file") continue;
		const fileHandle = handle as FileSystemFileHandle;
		const file = await fileHandle.getFile();
		const mimeType = inferMimeType(file);

		if (!isTextExtractable(file)) {
			out.push({
				relativePath,
				mimeType,
				extractedText: "",
				skippedReason: `unsupported-mime(${mimeType})`,
				folderName,
			});
			continue;
		}
		if (file.size > MAX_BYTES_PER_FILE) {
			out.push({
				relativePath,
				mimeType,
				extractedText: "",
				skippedReason: `too-large(${file.size}b)`,
				folderName,
			});
			continue;
		}
		const text = await file.text();
		out.push({
			relativePath,
			mimeType,
			extractedText: text,
			folderName,
		});
	}
}
