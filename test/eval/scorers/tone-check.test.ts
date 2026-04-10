import { scoreToneCheck } from "@eval/scorers/tone-check";
import { describe, expect, it } from "vitest";

describe("scoreToneCheck", () => {
	it("scores high for brief, plain, signed-off reply", () => {
		let reply = "Added to today's list. Dentist at 3pm Thursday. — Kit";
		let result = scoreToneCheck(reply);
		expect(result.score).toBeGreaterThanOrEqual(0.9);
		expect(result.metadata?.hasMarkdown).toBe(false);
	});

	it("penalizes replies containing markdown", () => {
		let reply = "Here's what I did:\n\n**Added** the dentist to your list.\n\n— Kit";
		let result = scoreToneCheck(reply);
		expect(result.metadata?.hasMarkdown).toBe(true);
		expect(result.score).toBeLessThan(0.9);
	});

	it("penalizes long replies (> 6 sentences)", () => {
		let reply = `${Array.from({ length: 10 }, (_, i) => `Sentence number ${i}.`).join(" ")} — Kit`;
		let result = scoreToneCheck(reply);
		expect(result.score).toBeLessThan(0.9);
	});

	it("penalizes missing signoff", () => {
		let result = scoreToneCheck("Got it, added.");
		expect(result.score).toBeLessThan(0.9);
	});

	it("scores 0 for empty or null input", () => {
		expect(scoreToneCheck("").score).toBe(0);
		expect(scoreToneCheck(null).score).toBe(0);
	});

	it("reports sentences and hasMarkdown in metadata", () => {
		let result = scoreToneCheck("Added. — Kit");
		expect(result.metadata?.sentences).toBeGreaterThanOrEqual(1);
		expect(typeof result.metadata?.hasMarkdown).toBe("boolean");
	});
});
