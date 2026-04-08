import { archiveOldEntries } from "@application/use-cases/archive-old-entries";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService } from "../helpers/mocks";

describe("archiveOldEntries", () => {
	let paths = createJournalPaths("journal/");

	it("archives entries older than 60 days", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let now = new Date(2026, 5, 15); // June 15

		// Seed an old entry (April 1 = 75 days ago)
		await journal.write(
			paths.dailyLog(2026, 4, 1),
			"- [x] Old completed task\n- A note from long ago",
			"test",
		);

		ai.nextResponse = "Completed an old task and made a note.";

		let result = await archiveOldEntries({ journal, ai, paths }, now);

		expect(result.archived.length).toBe(1);
		expect(result.archived[0]).toContain("04/01");
		expect(result.summarized).toBe(true);
		expect(result.errors.length).toBe(0);

		// Original should be deleted
		let original = await journal.read(paths.dailyLog(2026, 4, 1));
		expect(original).toBeNull();

		// Monthly log should have the summary
		let monthly = await journal.read(paths.monthlyLog(2026, 4));
		expect(monthly).not.toBeNull();
		expect(monthly?.content).toContain("Completed an old task");
	});

	it("keeps recent entries untouched", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let now = new Date(2026, 5, 15); // June 15

		// Seed a recent entry (June 10 = 5 days ago)
		await journal.write(paths.dailyLog(2026, 6, 10), "- [ ] Recent task", "test");

		let result = await archiveOldEntries({ journal, ai, paths }, now);

		expect(result.archived.length).toBe(0);
		expect(result.summarized).toBe(false);

		// Entry should still exist
		let entry = await journal.read(paths.dailyLog(2026, 6, 10));
		expect(entry).not.toBeNull();
	});

	it("handles no daily logs gracefully", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let now = new Date(2026, 5, 15);

		let result = await archiveOldEntries({ journal, ai, paths }, now);

		expect(result.archived.length).toBe(0);
		expect(result.errors.length).toBe(0);
	});

	it("captures errors without crashing", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let now = new Date(2026, 5, 15);

		// Seed an old entry
		await journal.write(paths.dailyLog(2026, 4, 1), "Some content", "test");

		// Make AI throw
		ai.complete = async () => {
			throw new Error("AI unavailable");
		};

		let result = await archiveOldEntries({ journal, ai, paths }, now);

		expect(result.errors.length).toBe(1);
		expect(result.errors[0]).toContain("AI unavailable");
	});
});
