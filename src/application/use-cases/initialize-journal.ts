import type { IJournalRepository } from "@application/ports/journal-repository";
import { JOURNAL_CONFIG } from "@config";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalPaths } from "@domain/entities/journal-path";
import { futureLogTemplate, indexTemplate, monthlyLogTemplate } from "@domain/entities/templates";

export interface InitializeJournalDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
}

export async function initializeJournal(
	deps: InitializeJournalDeps,
	now: Date,
): Promise<EditRecord[]> {
	let { journal, paths } = deps;
	let records: EditRecord[] = [];

	// Create index if it doesn't exist
	if (!(await journal.exists(paths.index()))) {
		records.push(await journal.write(paths.index(), indexTemplate(), "Initialized journal index"));
	}

	// Create future log if it doesn't exist
	if (!(await journal.exists(paths.futureLog()))) {
		records.push(
			await journal.write(
				paths.futureLog(),
				futureLogTemplate(now, JOURNAL_CONFIG.futureLogMonths),
				"Initialized future log",
			),
		);
	}

	// Create current month's log if it doesn't exist
	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let monthPath = paths.monthlyLog(y, m);
	if (!(await journal.exists(monthPath))) {
		let monthName = now.toLocaleString("en-US", { month: "long" });
		records.push(
			await journal.write(
				monthPath,
				monthlyLogTemplate(y, monthName),
				`Initialized ${monthName} ${y} monthly log`,
			),
		);
	}

	return records;
}
