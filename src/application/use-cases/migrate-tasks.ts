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
	const { journal, paths } = deps;

	const fromY = fromDate.getFullYear();
	const fromM = fromDate.getMonth() + 1;
	const fromD = fromDate.getDate();
	const toY = toDate.getFullYear();
	const toM = toDate.getMonth() + 1;
	const toD = toDate.getDate();

	const fromPath = paths.dailyLog(fromY, fromM, fromD);
	const toPath = paths.dailyLog(toY, toM, toD);

	const source = await journal.read(fromPath);
	if (!source) {
		return {
			date: fromDate.toISOString(),
			migrated: [],
			cancelled: [],
			kept: [],
			totalReviewed: 0,
		};
	}

	const lines = source.content.split("\n");
	const migrated: MigrationItem[] = [];
	const kept: string[] = [];
	const updatedSourceLines: string[] = [];
	let totalReviewed = 0;

	for (const line of lines) {
		const entry = parseBulletLine(line);

		if (!entry || entry.type !== "task") {
			updatedSourceLines.push(line);
			continue;
		}

		totalReviewed++;

		if (entry.state === "open") {
			const migratedEntry: BulletEntry = {
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

		const migratedLines = migrated.map((m) => `- [ ] ${m.content}`).join("\n");

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
