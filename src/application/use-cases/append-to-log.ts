import type { IJournalRepository } from "@application/ports/journal-repository";
import { serializeBullet } from "@domain/entities/bullet-parser";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { BulletEntry } from "@domain/entities/signifier";

export interface AppendToLogDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
}

export async function appendToLog(
	deps: AppendToLogDeps,
	date: Date,
	entry: BulletEntry,
): Promise<EditRecord> {
	const { journal, paths } = deps;
	const y = date.getFullYear();
	const m = date.getMonth() + 1;
	const d = date.getDate();
	const path = paths.dailyLog(y, m, d);

	const line = serializeBullet(entry);
	return journal.append(path, `${line}\n`, `Added ${entry.type}: ${entry.content}`);
}
