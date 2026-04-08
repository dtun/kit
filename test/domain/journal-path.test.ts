import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";

describe("JournalPaths", () => {
	const paths = createJournalPaths("journal/");

	it("generates index path", () => {
		expect(paths.index()).toBe("journal/index.txt");
	});

	it("generates future log path", () => {
		expect(paths.futureLog()).toBe("journal/future-log.txt");
	});

	it("generates monthly log path with zero-padded month", () => {
		expect(paths.monthlyLog(2026, 4)).toBe("journal/2026/04/month.txt");
		expect(paths.monthlyLog(2026, 12)).toBe("journal/2026/12/month.txt");
	});

	it("generates daily log path with zero-padded month and day", () => {
		expect(paths.dailyLog(2026, 4, 7)).toBe("journal/2026/04/07/daily.txt");
		expect(paths.dailyLog(2026, 1, 1)).toBe("journal/2026/01/01/daily.txt");
	});

	it("generates edit log path", () => {
		expect(paths.editLog(2026, 4, 7)).toBe("journal/2026/04/07/edits.log");
	});
});
