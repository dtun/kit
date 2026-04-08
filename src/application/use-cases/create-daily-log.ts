import type { IJournalRepository } from "@application/ports/journal-repository";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalPaths } from "@domain/entities/journal-path";
import { dailyLogTemplate } from "@domain/entities/templates";

export interface CreateDailyLogDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
}

export async function createDailyLog(deps: CreateDailyLogDeps, date: Date): Promise<EditRecord> {
	let { journal, paths } = deps;
	let y = date.getFullYear();
	let m = date.getMonth() + 1;
	let d = date.getDate();
	let path = paths.dailyLog(y, m, d);

	// Don't overwrite if it already exists
	let existing = await journal.read(path);
	if (existing) {
		return {
			timestamp: new Date().toISOString(),
			action: "update",
			path,
			reason: "Daily log already exists, skipped creation",
		};
	}

	let dayOfWeek = date.toLocaleString("en-US", { weekday: "long" });
	let content = dailyLogTemplate(date, dayOfWeek);

	return journal.write(path, content, `Created daily log for ${dayOfWeek}`);
}
