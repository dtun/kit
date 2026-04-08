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
	let { journal, paths } = deps;
	let y = date.getFullYear();
	let m = date.getMonth() + 1;
	let d = date.getDate();
	let path = paths.dailyLog(y, m, d);

	let line = serializeBullet(entry);
	return journal.append(path, `${line}\n`, `Added ${entry.type}: ${entry.content}`);
}
