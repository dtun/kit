import { COLD_START_RULES, detectColdStart } from "@domain/entities/cold-start";
import { describe, expect, it } from "vitest";

describe("detectColdStart", () => {
	it("is cold start when journal has 0 daily logs", () => {
		let ctx = detectColdStart(0, null, new Date());
		expect(ctx.isNew).toBe(true);
		expect(ctx.totalEntries).toBe(0);
		expect(ctx.daysSinceFirstEntry).toBe(0);
	});

	it("is cold start when journal has 1 daily log", () => {
		let ctx = detectColdStart(1, new Date(), new Date());
		expect(ctx.isNew).toBe(true);
		expect(ctx.totalEntries).toBe(1);
	});

	it("is cold start when journal has 2 daily logs", () => {
		let ctx = detectColdStart(2, new Date(), new Date());
		expect(ctx.isNew).toBe(true);
	});

	it("is NOT cold start when journal has exactly 3 daily logs", () => {
		let ctx = detectColdStart(3, new Date(), new Date());
		expect(ctx.isNew).toBe(false);
	});

	it("is NOT cold start when journal has 5 daily logs", () => {
		let ctx = detectColdStart(5, new Date(2026, 3, 1), new Date(2026, 3, 9));
		expect(ctx.isNew).toBe(false);
		expect(ctx.daysSinceFirstEntry).toBe(8);
		expect(ctx.totalEntries).toBe(5);
	});

	it("returns daysSinceFirstEntry of 0 when firstEntryDate is null", () => {
		let ctx = detectColdStart(0, null, new Date(2026, 3, 9));
		expect(ctx.daysSinceFirstEntry).toBe(0);
	});
});

describe("COLD_START_RULES", () => {
	it("is a non-empty list of rules", () => {
		expect(COLD_START_RULES.length).toBeGreaterThan(0);
	});

	it("contains the 'Never say' guidance", () => {
		expect(COLD_START_RULES.some((r) => r.includes("Never say"))).toBe(true);
	});

	it("tells Kit to take action first", () => {
		expect(COLD_START_RULES.some((r) => r.toLowerCase().includes("action"))).toBe(true);
	});
});
