import { initializeJournal } from "@application/use-cases/initialize-journal";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

describe("InitializeJournal", () => {
	it("creates index, future log, and monthly log", async () => {
		const journal = new InMemoryJournalRepository();
		const paths = createJournalPaths("journal/");
		const now = new Date(2026, 3, 7);

		const records = await initializeJournal({ journal, paths }, now);

		expect(records.length).toBe(3);
		expect(await journal.exists("journal/index.txt")).toBe(true);
		expect(await journal.exists("journal/future-log.txt")).toBe(true);
		expect(await journal.exists("journal/2026/04/month.txt")).toBe(true);
	});

	it("skips files that already exist", async () => {
		const journal = new InMemoryJournalRepository();
		const paths = createJournalPaths("journal/");
		const now = new Date(2026, 3, 7);

		await journal.write("journal/index.txt", "existing", "test");
		const records = await initializeJournal({ journal, paths }, now);

		expect(records.length).toBe(2); // only future-log and monthly
	});
});
