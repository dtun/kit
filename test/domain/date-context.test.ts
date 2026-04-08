import { createDateContext } from "@domain/entities/date-context";
import { describe, expect, it } from "vitest";

describe("createDateContext", () => {
	it("correctly identifies Sunday", () => {
		const ctx = createDateContext(new Date(2026, 3, 5)); // April 5, 2026 = Sunday
		expect(ctx.isSunday).toBe(true);
		expect(ctx.dayOfWeek).toBe("Sunday");
		expect(ctx.daysLeftInWeek).toBe(6);
	});

	it("correctly identifies Monday", () => {
		const ctx = createDateContext(new Date(2026, 3, 6)); // April 6, 2026 = Monday
		expect(ctx.isMonday).toBe(true);
		expect(ctx.daysLeftInWeek).toBe(5);
	});

	it("correctly identifies weekend", () => {
		const sat = createDateContext(new Date(2026, 3, 4)); // Saturday
		expect(sat.isWeekend).toBe(true);
		const wed = createDateContext(new Date(2026, 3, 8)); // Wednesday
		expect(wed.isWeekend).toBe(false);
	});

	it("correctly identifies first of month", () => {
		const first = createDateContext(new Date(2026, 3, 1));
		expect(first.isFirstOfMonth).toBe(true);
		const third = createDateContext(new Date(2026, 3, 3));
		expect(third.isFirstOfMonth).toBe(false);
	});

	it("provides correct year, month, day", () => {
		const ctx = createDateContext(new Date(2026, 3, 7));
		expect(ctx.year).toBe(2026);
		expect(ctx.month).toBe(4);
		expect(ctx.day).toBe(7);
	});
});
