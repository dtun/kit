import { createDailyLog } from "@application/use-cases/create-daily-log";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

describe("CreateDailyLog", () => {
	it("creates a new daily log for a given date", async () => {
		let journal = new InMemoryJournalRepository();
		let paths = createJournalPaths("journal/");
		let date = new Date(2026, 3, 7); // April 7, 2026

		let record = await createDailyLog({ journal, paths }, date);

		expect(record.action).toBe("create");
		expect(record.path).toBe("journal/2026/04/07/daily.txt");

		let entry = await journal.read("journal/2026/04/07/daily.txt");
		expect(entry).not.toBeNull();
		expect(entry?.content).toContain("April 7, 2026");
	});

	it("does not overwrite an existing daily log", async () => {
		let journal = new InMemoryJournalRepository();
		let paths = createJournalPaths("journal/");
		let date = new Date(2026, 3, 7);

		await journal.write("journal/2026/04/07/daily.txt", "existing content", "test");

		let record = await createDailyLog({ journal, paths }, date);

		expect(record.reason).toContain("already exists");
		let entry = await journal.read("journal/2026/04/07/daily.txt");
		expect(entry?.content).toBe("existing content");
	});
});
