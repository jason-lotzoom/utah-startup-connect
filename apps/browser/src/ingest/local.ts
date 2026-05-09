/**
 * Local-folder ingestion via the File System Access API.
 *
 * The popup invokes `pickAndReadFolder()` which opens the directory picker,
 * walks the tree (one level deep by default to keep demo perf tight),
 * extracts text from supported MIME types, and returns an array shaped
 * for the `startupState/ingest:writeLocalSignals` action.
 */

const MAX_FILES = 60;
const MAX_BYTES_PER_FILE = 1_500_000;

const TEXT_EXTENSIONS = [
	".md",
	".markdown",
	".txt",
	".rtf",
	".csv",
	".json",
	".log",
	".text",
] as const;

const TEXT_MIME_PREFIXES = ["text/", "application/json"];

export interface LocalSignalUpload {
	relativePath: string;
	mimeType: string;
	extractedText: string;
	skippedReason?: string;
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

function inferMimeType(file: File): string {
	if (file.type) return file.type;
	const lower = file.name.toLowerCase();
	if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
	if (lower.endsWith(".txt") || lower.endsWith(".text")) return "text/plain";
	if (lower.endsWith(".csv")) return "text/csv";
	if (lower.endsWith(".json")) return "application/json";
	return "application/octet-stream";
}

function isTextExtractable(file: File): boolean {
	const lower = file.name.toLowerCase();
	if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
	const mime = file.type;
	return TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export async function pickAndReadFolder(): Promise<LocalSignalUpload[]> {
	if (!window.showDirectoryPicker) {
		throw new Error("File System Access API not supported in this browser");
	}
	const dir = await window.showDirectoryPicker({ mode: "read" });
	return readFolderHandle(dir);
}

export async function readFolderHandle(
	dir: FileSystemDirectoryHandle,
	prefix = "",
): Promise<LocalSignalUpload[]> {
	const out: LocalSignalUpload[] = [];
	for await (const [name, handle] of dir.entries()) {
		if (out.length >= MAX_FILES) break;
		if (handle.kind !== "file") continue;
		const fileHandle = handle as FileSystemFileHandle;
		const file = await fileHandle.getFile();
		const relativePath = prefix ? `${prefix}/${name}` : name;
		const mimeType = inferMimeType(file);

		if (!isTextExtractable(file)) {
			out.push({
				relativePath,
				mimeType,
				extractedText: "",
				skippedReason: `unsupported-mime(${mimeType})`,
			});
			continue;
		}
		if (file.size > MAX_BYTES_PER_FILE) {
			out.push({
				relativePath,
				mimeType,
				extractedText: "",
				skippedReason: `too-large(${file.size}b)`,
			});
			continue;
		}
		const text = await file.text();
		out.push({
			relativePath,
			mimeType,
			extractedText: text,
		});
	}
	return out;
}
