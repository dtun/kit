import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import { parseDateFromPath, shouldArchive } from "@domain/entities/archive-policy";
import type { JournalPaths } from "@domain/entities/journal-path";

export interface ArchiveOldEntriesDeps {
	journal: IJournalRepository;
	ai: IAIService;
	paths: JournalPaths;
}

export interface ArchiveResult {
	readonly archived: string[];
	readonly summarized: boolean;
	readonly errors: string[];
}

export async function archiveOldEntries(
	deps: ArchiveOldEntriesDeps,
	now: Date,
): Promise<ArchiveResult> {
	let { journal, ai, paths } = deps;
	let archived: string[] = [];
	let errors: string[] = [];

	let allKeys = await journal.list(paths.yearDir(now.getFullYear()));
	let dailyLogKeys = allKeys.filter((k) => k.endsWith("/daily.txt"));

	for (let key of dailyLogKeys) {
		let entryDate = parseDateFromPath(key);
		if (!entryDate) continue;

		let decision = shouldArchive(key, entryDate, now);
		if (decision.action !== "archive") continue;

		try {
			let entry = await journal.read(key);
			if (!entry) continue;

			let monthPath = paths.monthlyLog(entryDate.getFullYear(), entryDate.getMonth() + 1);
			let dayLabel = entryDate.toLocaleString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			});

			let summary = await ai.complete(
				"Summarize this daily log in one sentence. Be factual and brief.",
				entry.content,
			);

			await journal.append(
				monthPath,
				`\n${dayLabel}: ${summary.trim()}\n`,
				`Archived ${key} — ${decision.reason}`,
			);

			await journal.delete(key, decision.reason);
			archived.push(key);
		} catch (err) {
			errors.push(`Failed to archive ${key}: ${err}`);
		}
	}

	return {
		archived,
		summarized: archived.length > 0,
		errors,
	};
}
