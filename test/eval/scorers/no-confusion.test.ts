import { scoreNoConfusion } from "@eval/scorers/no-confusion";
import { describe, expect, it } from "vitest";

describe("scoreNoConfusion", () => {
	it("scores 1 for a clean confident reply", () => {
		let reply = "Got it — dentist Thursday at 3pm added to the calendar. — Kit";
		let result = scoreNoConfusion(reply);
		expect(result.score).toBe(1);
		expect(result.metadata?.violationCount).toBe(0);
	});

	it("scores 0 for empty input (absent ≠ confident)", () => {
		let result = scoreNoConfusion("");
		expect(result.score).toBe(0);
		expect(result.metadata?.empty).toBe(true);
	});

	it("scores 0 when the reply contains 'I don't have any context'", () => {
		let result = scoreNoConfusion("I don't have any context yet.");
		expect(result.score).toBe(0);
		expect(result.metadata?.violations).toContain("i don't have any context");
	});

	it("scores 0 when the reply asks the user to clarify", () => {
		let result = scoreNoConfusion("Could you clarify what you mean?");
		expect(result.score).toBe(0);
	});

	it("is case-insensitive", () => {
		let result = scoreNoConfusion("I'M NOT SURE WHAT YOU'RE LOOKING FOR");
		expect(result.score).toBe(0);
	});

	it("scores 0 on non-string input (absent ≠ confident)", () => {
		let result = scoreNoConfusion(null);
		expect(result.score).toBe(0);
	});
});
