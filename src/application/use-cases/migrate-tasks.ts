import type { IJournalRepository } from "@application/ports/journal-repository";
import { parseBulletLine, serializeBullet } from "@domain/entities/bullet-parser";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { MigrationItem, MigrationResult } from "@domain/entities/migration-result";
import type { BulletEntry } from "@domain/entities/signifier";

export interface MigrateTasksDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
}

export async function migrateTasks(
	deps: MigrateTasksDeps,
	fromDate: Date,
	toDate: Date,
): Promise<MigrationResult> {
	let { journal, paths } = deps;

	let fromY = fromDate.getFullYear();
	let fromM = fromDate.getMonth() + 1;
	let fromD = fromDate.getDate();
	let toY = toDate.getFullYear();
	let toM = toDate.getMonth() + 1;
	let toD = toDate.getDate();

	let fromPath = paths.dailyLog(fromY, fromM, fromD);
	let toPath = paths.dailyLog(toY, toM, toD);

	let source = await journal.read(fromPath);
	if (!source) {
		return {
			date: fromDate.toISOString(),
			migrated: [],
			cancelled: [],
			kept: [],
			totalReviewed: 0,
		};
	}

	let lines = source.content.split("\n");
	let migrated: MigrationItem[] = [];
	let kept: string[] = [];
	let updatedSourceLines: string[] = [];
	let totalReviewed = 0;

	for (let line of lines) {
		let entry = parseBulletLine(line);

		if (!entry || entry.type !== "task") {
			updatedSourceLines.push(line);
			continue;
		}

		totalReviewed++;

		if (entry.state === "open") {
			let migratedEntry: BulletEntry = {
				...entry,
				state: "migrated",
			};
			updatedSourceLines.push(serializeBullet(migratedEntry));

			migrated.push({
				originalPath: fromPath,
				destinationPath: toPath,
				content: entry.content,
				reason: "Open task from yesterday, migrated forward",
			});
		} else {
			updatedSourceLines.push(line);
			kept.push(entry.content);
		}
	}

	if (migrated.length > 0) {
		await journal.write(
			fromPath,
			updatedSourceLines.join("\n"),
			`Migrated ${migrated.length} open task(s) forward to ${toPath}`,
		);

		let migratedLines = migrated.map((m) => `- [ ] ${m.content}`).join("\n");

		await journal.append(
			toPath,
			`\n## Migrated from ${fromM}/${fromD}\n${migratedLines}\n`,
			`Received ${migrated.length} migrated task(s) from ${fromPath}`,
		);
	}

	return {
		date: fromDate.toISOString(),
		migrated,
		cancelled: [],
		kept,
		totalReviewed,
	};
}
