import { rollMonthForward } from "@application/use-cases/roll-month-forward";
import { createDateContext } from "@domain/entities/date-context";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

describe("rollMonthForward", () => {
	let paths = createJournalPaths("journal/");

	it("creates monthly log on first of month", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 4, 1)); // May 1

		let records = await rollMonthForward({ journal, paths }, dateCtx);

		expect(records.length).toBeGreaterThan(0);

		let monthly = await journal.read(paths.monthlyLog(2026, 5));
		expect(monthly).not.toBeNull();
		expect(monthly?.content).toContain("May");
	});

	it("refreshes future log on first of month", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 4, 1)); // May 1

		await rollMonthForward({ journal, paths }, dateCtx);

		let futureLog = await journal.read(paths.futureLog());
		expect(futureLog).not.toBeNull();
		expect(futureLog?.content).toContain("Future Log");
	});

	it("does nothing when not first of month", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 15)); // April 15

		let records = await rollMonthForward({ journal, paths }, dateCtx);

		expect(records.length).toBe(0);
	});

	it("does not overwrite existing monthly log", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 4, 1)); // May 1

		// Pre-create monthly log with custom content
		await journal.write(paths.monthlyLog(2026, 5), "Custom content", "pre-existing");

		await rollMonthForward({ journal, paths }, dateCtx);

		let monthly = await journal.read(paths.monthlyLog(2026, 5));
		expect(monthly?.content).toBe("Custom content");
	});
});
