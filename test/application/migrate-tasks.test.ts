import { migrateTasks } from "@application/use-cases/migrate-tasks";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

describe("migrateTasks", () => {
	const paths = createJournalPaths("journal/");

	it("migrates open tasks from yesterday to today", async () => {
		const journal = new InMemoryJournalRepository();
		const yesterday = new Date(2026, 3, 6);
		const today = new Date(2026, 3, 7);

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

		const result = await migrateTasks({ journal, paths }, yesterday, today);

		expect(result.migrated.length).toBe(2);
		expect(result.kept.length).toBe(1);
		expect(result.totalReviewed).toBe(3);

		// Source should have tasks marked as migrated
		const source = await journal.read(paths.dailyLog(2026, 4, 6));
		expect(source?.content).toContain("[>]");
		expect(source?.content).not.toContain("- [ ] Call plumber");

		// Destination should have the migrated tasks
		const dest = await journal.read(paths.dailyLog(2026, 4, 7));
		expect(dest?.content).toContain("Call plumber");
		expect(dest?.content).toContain("Fix fence");
		expect(dest?.content).toContain("Migrated from");
	});

	it("handles empty source gracefully", async () => {
		const journal = new InMemoryJournalRepository();
		const yesterday = new Date(2026, 3, 6);
		const today = new Date(2026, 3, 7);

		const result = await migrateTasks({ journal, paths }, yesterday, today);

		expect(result.migrated.length).toBe(0);
		expect(result.totalReviewed).toBe(0);
	});

	it("does not migrate completed or cancelled tasks", async () => {
		const journal = new InMemoryJournalRepository();
		const yesterday = new Date(2026, 3, 6);
		const today = new Date(2026, 3, 7);

		await journal.write(
			paths.dailyLog(2026, 4, 6),
			"- [x] Done\n- [-] Cancelled\n- [>] Already migrated\n",
			"test",
		);
		await journal.write(paths.dailyLog(2026, 4, 7), "# Today\n", "test");

		const result = await migrateTasks({ journal, paths }, yesterday, today);

		expect(result.migrated.length).toBe(0);
	});

	it("preserves non-task lines in the source", async () => {
		const journal = new InMemoryJournalRepository();
		const yesterday = new Date(2026, 3, 6);
		const today = new Date(2026, 3, 7);

		await journal.write(
			paths.dailyLog(2026, 4, 6),
			["# Monday", "", "## Tasks", "- [ ] Open task", "## Notes", "- A note"].join("\n"),
			"test",
		);
		await journal.write(paths.dailyLog(2026, 4, 7), "# Today\n", "test");

		await migrateTasks({ journal, paths }, yesterday, today);

		const source = await journal.read(paths.dailyLog(2026, 4, 6));
		expect(source?.content).toContain("# Monday");
		expect(source?.content).toContain("## Notes");
		expect(source?.content).toContain("- A note");
	});
});
