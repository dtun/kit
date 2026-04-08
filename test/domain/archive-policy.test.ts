import { parseDateFromPath, shouldArchive } from "@domain/entities/archive-policy";
import { describe, expect, it } from "vitest";

describe("shouldArchive", () => {
	it("archives entries older than threshold", () => {
		const now = new Date(2026, 5, 15); // June 15
		const entryDate = new Date(2026, 3, 1); // April 1 — 75 days ago
		const decision = shouldArchive("journal/2026/04/01/daily.txt", entryDate, now);
		expect(decision.action).toBe("archive");
		expect(decision.ageInDays).toBe(75);
	});

	it("keeps recent entries", () => {
		const now = new Date(2026, 3, 15); // April 15
		const entryDate = new Date(2026, 3, 10); // April 10 — 5 days ago
		const decision = shouldArchive("journal/2026/04/10/daily.txt", entryDate, now);
		expect(decision.action).toBe("keep");
	});

	it("archives entries exactly at the threshold", () => {
		const now = new Date(2026, 5, 1); // June 1
		const entryDate = new Date(2026, 3, 2); // April 2 — exactly 60 days
		const decision = shouldArchive("journal/2026/04/02/daily.txt", entryDate, now);
		expect(decision.action).toBe("archive");
		expect(decision.ageInDays).toBe(60);
	});

	it("keeps entries one day before threshold", () => {
		const now = new Date(2026, 5, 1); // June 1
		const entryDate = new Date(2026, 3, 3); // April 3 — 59 days
		const decision = shouldArchive("journal/2026/04/03/daily.txt", entryDate, now);
		expect(decision.action).toBe("keep");
		expect(decision.ageInDays).toBe(59);
	});

	it("includes the path in the decision", () => {
		const now = new Date(2026, 5, 15);
		const entryDate = new Date(2026, 3, 1);
		const decision = shouldArchive("journal/2026/04/01/daily.txt", entryDate, now);
		expect(decision.path).toBe("journal/2026/04/01/daily.txt");
	});

	it("includes a human-readable reason", () => {
		const now = new Date(2026, 5, 15);
		const entryDate = new Date(2026, 3, 1);
		const decision = shouldArchive("journal/2026/04/01/daily.txt", entryDate, now);
		expect(decision.reason).toContain("75");
		expect(decision.reason).toContain("60");
	});
});

describe("parseDateFromPath", () => {
	it("extracts date from daily log path", () => {
		const date = parseDateFromPath("journal/2026/04/07/daily.txt");
		expect(date).not.toBeNull();
		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(3); // 0-indexed
		expect(date?.getDate()).toBe(7);
	});

	it("extracts date from edit log path", () => {
		const date = parseDateFromPath("journal/2026/12/25/edits.log");
		expect(date).not.toBeNull();
		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(11);
		expect(date?.getDate()).toBe(25);
	});

	it("returns null for index path", () => {
		expect(parseDateFromPath("journal/index.txt")).toBeNull();
	});

	it("returns null for future log path", () => {
		expect(parseDateFromPath("journal/future-log.txt")).toBeNull();
	});

	it("returns null for monthly log path without day", () => {
		expect(parseDateFromPath("journal/2026/04/month.txt")).toBeNull();
	});
});
