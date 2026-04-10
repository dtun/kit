import { scoreSignoffCheck } from "@eval/scorers/signoff-check";
import { describe, expect, it } from "vitest";

describe("scoreSignoffCheck", () => {
	it("scores 1 for em-dash signoff", () => {
		let result = scoreSignoffCheck("Done.\n\n— Kit");
		expect(result.score).toBe(1);
	});

	it("scores 1 for ASCII dash signoff", () => {
		let result = scoreSignoffCheck("Done.\n\n- Kit");
		expect(result.score).toBe(1);
	});

	it("scores 1 with trailing whitespace", () => {
		let result = scoreSignoffCheck("Done.\n\n— Kit   \n");
		expect(result.score).toBe(1);
	});

	it("scores 0 when signoff is missing", () => {
		let result = scoreSignoffCheck("Done. No signoff.");
		expect(result.score).toBe(0);
	});

	it("scores 0 for empty string", () => {
		let result = scoreSignoffCheck("");
		expect(result.score).toBe(0);
	});

	it("scores 0 on null input", () => {
		let result = scoreSignoffCheck(null);
		expect(result.score).toBe(0);
	});

	it("reports the last line in metadata", () => {
		let result = scoreSignoffCheck("line 1\nline 2\n— Kit");
		expect(result.metadata?.lastLine).toBe("— Kit");
	});
});
