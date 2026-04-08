import type { IJournalRepository } from "@application/ports/journal-repository";
import { JOURNAL_CONFIG } from "@config";
import type { DateContext } from "@domain/entities/date-context";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalPaths } from "@domain/entities/journal-path";
import { futureLogTemplate, monthlyLogTemplate } from "@domain/entities/templates";

export interface RollMonthForwardDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
}

export async function rollMonthForward(
	deps: RollMonthForwardDeps,
	dateCtx: DateContext,
): Promise<EditRecord[]> {
	const { journal, paths } = deps;
	const records: EditRecord[] = [];

	if (!dateCtx.isFirstOfMonth) return records;

	const monthName = dateCtx.now.toLocaleString("en-US", { month: "long" });

	const monthPath = paths.monthlyLog(dateCtx.year, dateCtx.month);
	if (!(await journal.exists(monthPath))) {
		records.push(
			await journal.write(
				monthPath,
				monthlyLogTemplate(dateCtx.year, monthName),
				`New month: created ${monthName} ${dateCtx.year} monthly log`,
			),
		);
	}

	const futureLogPath = paths.futureLog();
	records.push(
		await journal.write(
			futureLogPath,
			futureLogTemplate(dateCtx.now, JOURNAL_CONFIG.futureLogMonths),
			`Refreshed future log for ${monthName} ${dateCtx.year}`,
		),
	);

	return records;
}
