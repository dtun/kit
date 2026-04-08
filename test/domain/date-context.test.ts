import { createDateContext } from "@domain/entities/date-context";
import { describe, expect, it } from "vitest";

describe("createDateContext", () => {
	it("correctly identifies Sunday", () => {
		let ctx = createDateContext(new Date(2026, 3, 5)); // April 5, 2026 = Sunday
		expect(ctx.isSunday).toBe(true);
		expect(ctx.dayOfWeek).toBe("Sunday");
		expect(ctx.daysLeftInWeek).toBe(6);
	});

	it("correctly identifies Monday", () => {
		let ctx = createDateContext(new Date(2026, 3, 6)); // April 6, 2026 = Monday
		expect(ctx.isMonday).toBe(true);
		expect(ctx.daysLeftInWeek).toBe(5);
	});

	it("correctly identifies weekend", () => {
		let sat = createDateContext(new Date(2026, 3, 4)); // Saturday
		expect(sat.isWeekend).toBe(true);
		let wed = createDateContext(new Date(2026, 3, 8)); // Wednesday
		expect(wed.isWeekend).toBe(false);
	});

	it("correctly identifies first of month", () => {
		let first = createDateContext(new Date(2026, 3, 1));
		expect(first.isFirstOfMonth).toBe(true);
		let third = createDateContext(new Date(2026, 3, 3));
		expect(third.isFirstOfMonth).toBe(false);
	});

	it("provides correct year, month, day", () => {
		let ctx = createDateContext(new Date(2026, 3, 7));
		expect(ctx.year).toBe(2026);
		expect(ctx.month).toBe(4);
		expect(ctx.day).toBe(7);
	});

	describe("ISO 8601 week number", () => {
		it("returns week 1 for Jan 1 2026 (Thursday)", () => {
			let ctx = createDateContext(new Date(2026, 0, 1));
			expect(ctx.weekNumber).toBe(1);
		});

		it("returns week 1 for Dec 29 2025 (Monday) — late Dec belongs to next year's W01", () => {
			let ctx = createDateContext(new Date(2025, 11, 29));
			expect(ctx.weekNumber).toBe(1);
		});

		it("returns week 1 for Jan 1 2025 (Wednesday)", () => {
			let ctx = createDateContext(new Date(2025, 0, 1));
			expect(ctx.weekNumber).toBe(1);
		});

		it("returns week 1 for Dec 30 2024 (Monday) — late Dec belongs to next year's W01", () => {
			let ctx = createDateContext(new Date(2024, 11, 30));
			expect(ctx.weekNumber).toBe(1);
		});

		it("returns week 52 for Jan 1 2023 (Sunday) — early Jan belongs to previous year's W52", () => {
			let ctx = createDateContext(new Date(2023, 0, 1));
			expect(ctx.weekNumber).toBe(52);
		});

		it("returns week 53 for Dec 31 2020 (Thursday) — 2020 has 53 weeks", () => {
			let ctx = createDateContext(new Date(2020, 11, 31));
			expect(ctx.weekNumber).toBe(53);
		});

		it("returns week 15 for Apr 7 2026 (Tuesday) — mid-year", () => {
			let ctx = createDateContext(new Date(2026, 3, 7));
			expect(ctx.weekNumber).toBe(15);
		});

		it("returns week 25 for Jun 15 2026 (Monday) — mid-year", () => {
			let ctx = createDateContext(new Date(2026, 5, 15));
			expect(ctx.weekNumber).toBe(25);
		});
	});
});
