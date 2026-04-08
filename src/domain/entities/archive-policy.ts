import { JOURNAL_CONFIG } from "@config";

export interface ArchiveDecision {
	readonly path: string;
	readonly action: "archive" | "keep";
	readonly reason: string;
	readonly ageInDays: number;
}

export function shouldArchive(entryPath: string, entryDate: Date, now: Date): ArchiveDecision {
	let ageMs = now.getTime() - entryDate.getTime();
	let ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

	if (ageInDays >= JOURNAL_CONFIG.archiveAfterDays) {
		return {
			path: entryPath,
			action: "archive",
			reason: `Entry is ${ageInDays} days old (threshold: ${JOURNAL_CONFIG.archiveAfterDays})`,
			ageInDays,
		};
	}

	return {
		path: entryPath,
		action: "keep",
		reason: `Entry is ${ageInDays} days old, within retention window`,
		ageInDays,
	};
}

export function parseDateFromPath(path: string): Date | null {
	let match = path.match(/(\d{4})\/(\d{2})\/(\d{2})\//);
	if (!match) return null;
	return new Date(
		Number.parseInt(match[1]),
		Number.parseInt(match[2]) - 1,
		Number.parseInt(match[3]),
	);
}
