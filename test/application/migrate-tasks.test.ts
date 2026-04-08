import { migrateTasks } from "@application/use-cases/migrate-tasks";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

describe("migrateTasks", () => {
	let paths = createJournalPaths("journal/");

	it("migrates open tasks from yesterday to today", async () => {
		let journal = new InMemoryJournalRepository();
		let yesterday = new Date(2026, 3, 6);
		let today = new Date(2026, 3, 7);

		await journal.write(
			paths.dailyLog(2026, 4, 6),
			[
				"# Monday, April 6, 2026",
				"",
				"## Tasks",
				"- [ ] Call plumber",
				"- [x] Buy milk",
				"- [ ] Fix fence",
				"",
				"## Notes",
				"- Weather was nice",
			].join("\n"),
			"test seed",
		);

		await journal.write(
			paths.dailyLog(2026, 4, 7),
			"# Tuesday, April 7, 2026\n\n## Tasks\n",
			"test",
		);

		let result = await migrateTasks({ journal, paths }, yesterday, today);

		expect(result.migrated.length).toBe(2);
		expect(result.kept.length).toBe(1);
		expect(result.totalReviewed).toBe(3);

		// Source should have tasks marked as migrated
		let source = await journal.read(paths.dailyLog(2026, 4, 6));
		expect(source?.content).toContain("[>]");
		expect(source?.content).not.toContain("- [ ] Call plumber");

		// Destination should have the migrated tasks
		let dest = await journal.read(paths.dailyLog(2026, 4, 7));
		expect(dest?.content).toContain("Call plumber");
		expect(dest?.content).toContain("Fix fence");
		expect(dest?.content).toContain("Migrated from");
	});

	it("handles empty source gracefully", async () => {
		let journal = new InMemoryJournalRepository();
		let yesterday = new Date(2026, 3, 6);
		let today = new Date(2026, 3, 7);

		let result = await migrateTasks({ journal, paths }, yesterday, today);

		expect(result.migrated.length).toBe(0);
		expect(result.totalReviewed).toBe(0);
	});

	it("does not migrate completed or cancelled tasks", async () => {
		let journal = new InMemoryJournalRepository();
		let yesterday = new Date(2026, 3, 6);
		let today = new Date(2026, 3, 7);

		await journal.write(
			paths.dailyLog(2026, 4, 6),
			"- [x] Done\n- [-] Cancelled\n- [>] Already migrated\n",
			"test",
		);
		await journal.write(paths.dailyLog(2026, 4, 7), "# Today\n", "test");

		let result = await migrateTasks({ journal, paths }, yesterday, today);

		expect(result.migrated.length).toBe(0);
	});

	it("preserves non-task lines in the source", async () => {
		let journal = new InMemoryJournalRepository();
		let yesterday = new Date(2026, 3, 6);
		let today = new Date(2026, 3, 7);

		await journal.write(
			paths.dailyLog(2026, 4, 6),
			["# Monday", "", "## Tasks", "- [ ] Open task", "## Notes", "- A note"].join("\n"),
			"test",
		);
		await journal.write(paths.dailyLog(2026, 4, 7), "# Today\n", "test");

		await migrateTasks({ journal, paths }, yesterday, today);

		let source = await journal.read(paths.dailyLog(2026, 4, 6));
		expect(source?.content).toContain("# Monday");
		expect(source?.content).toContain("## Notes");
		expect(source?.content).toContain("- A note");
	});
});
