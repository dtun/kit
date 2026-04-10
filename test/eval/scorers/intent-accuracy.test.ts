import { scoreIntentAccuracy } from "@eval/scorers/intent-accuracy";
import { describe, expect, it } from "vitest";

describe("scoreIntentAccuracy", () => {
	it("scores 1 when intents match", () => {
		let result = scoreIntentAccuracy(
			{ intent: "remember", confidence: 0.9, extractedData: { tags: [] } },
			{ intent: "remember" },
		);
		expect(result.score).toBe(1);
	});

	it("scores 0 when intents mismatch", () => {
		let result = scoreIntentAccuracy(
			{ intent: "task", confidence: 0.9, extractedData: { tags: [] } },
			{ intent: "remember" },
		);
		expect(result.score).toBe(0);
	});

	it("scores 0 when output is null/undefined", () => {
		let result = scoreIntentAccuracy(null, { intent: "remember" });
		expect(result.score).toBe(0);
	});

	it("scores 0 when expected is missing", () => {
		let result = scoreIntentAccuracy(
			{ intent: "remember", confidence: 0.9, extractedData: { tags: [] } },
			null,
		);
		expect(result.score).toBe(0);
	});

	it("reports expected, got, and confidence in metadata", () => {
		let result = scoreIntentAccuracy(
			{ intent: "recall", confidence: 0.75, extractedData: { tags: [] } },
			{ intent: "recall" },
		);
		expect(result.metadata?.expected).toBe("recall");
		expect(result.metadata?.got).toBe("recall");
		expect(result.metadata?.confidence).toBe(0.75);
	});
});
