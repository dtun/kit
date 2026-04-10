import { scoreExtractionQuality } from "@eval/scorers/extraction-quality";
import { describe, expect, it } from "vitest";

describe("scoreExtractionQuality", () => {
	it("scores 1 when every expected fact is present", () => {
		let output = "Belt test on April 18th confirmed; uniform has been ordered for you.";
		let result = scoreExtractionQuality(output, {
			keyFacts: ["Belt test April 18th", "Uniform ordered"],
		});
		expect(result.score).toBe(1);
		expect(result.metadata?.found).toBe(2);
		expect(result.metadata?.total).toBe(2);
	});

	it("scores proportionally for a partial match", () => {
		let output = "Only remembered the belt test on April 18th.";
		let result = scoreExtractionQuality(output, {
			keyFacts: ["Belt test April 18th", "Uniform ordered", "Registered confirmed"],
		});
		expect(result.score).toBeCloseTo(1 / 3, 5);
		expect(result.metadata?.missing).toContain("Uniform ordered");
	});

	it("scores 0 when output is missing", () => {
		let result = scoreExtractionQuality(null, { keyFacts: ["something"] });
		expect(result.score).toBe(0);
	});

	it("scores 0 when expected.keyFacts is missing", () => {
		let result = scoreExtractionQuality("some output", null);
		expect(result.score).toBe(0);
	});

	it("performs fuzzy word-overlap matching (≥50% of long words)", () => {
		let output = "early release dismissed at 1:30 pm";
		let result = scoreExtractionQuality(output, {
			keyFacts: ["Early release April 14"],
		});
		// 2 long words: "early", "release" — both hit → matched
		expect(result.score).toBe(1);
	});
});
