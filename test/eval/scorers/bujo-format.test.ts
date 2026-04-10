import { scoreBujoFormat } from "@eval/scorers/bujo-format";
import { describe, expect, it } from "vitest";

describe("scoreBujoFormat", () => {
	it("scores 1 for all-valid bujo entries", () => {
		let input = [
			"- [ ] call dentist",
			"- [x] paid bills",
			"- meeting notes",
			"! urgent thing",
		].join("\n");
		let result = scoreBujoFormat(input);
		expect(result.score).toBe(1);
	});

	it("ignores markdown headers when scoring", () => {
		let input = ["# Today", "## Tasks", "- [ ] call dentist"].join("\n");
		let result = scoreBujoFormat(input);
		expect(result.score).toBe(1);
	});

	it("scores proportionally for mixed valid/invalid", () => {
		let input = ["- [ ] task a", "random plain line no prefix", "- [x] done"].join("\n");
		let result = scoreBujoFormat(input);
		expect(result.score).toBeCloseTo(2 / 3, 5);
		expect(result.metadata?.validLines).toBe(2);
		expect(result.metadata?.totalContentLines).toBe(3);
	});

	it("scores 0 for an empty string", () => {
		let result = scoreBujoFormat("");
		expect(result.score).toBe(0);
	});

	it("scores 0 for a header-only document", () => {
		let result = scoreBujoFormat("# Only a header");
		expect(result.score).toBe(0);
	});

	it("scores 0 for non-string input", () => {
		let result = scoreBujoFormat(null);
		expect(result.score).toBe(0);
	});

	it("accepts migrated/scheduled/cancelled/event signifiers", () => {
		let input = ["- [>] migrated", "- [<] scheduled", "- [-] cancelled", "- [o] event"].join("\n");
		let result = scoreBujoFormat(input);
		expect(result.score).toBe(1);
	});
});
