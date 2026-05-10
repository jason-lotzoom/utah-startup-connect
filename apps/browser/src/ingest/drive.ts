/**
 * Drive folder picker. The full Google Picker SDK requires an embedded
 * iframe + apiKey + appId; for hackathon scope we collect the folder ID
 * via a simple prompt. The popup can paste the folder URL/ID and the
 * backend's `sweepDrive` action does the heavy lifting.
 */

export function extractFolderId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
	if (folderMatch) return folderMatch[1];
	if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
	return null;
}
