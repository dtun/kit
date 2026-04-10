import {
	INTENT_TYPES,
	buildClassificationSystemPrompt,
	parseClassificationJson,
} from "@adapters/ai/intent-prompt";
import { describe, expect, it } from "vitest";

describe("intent-prompt module", () => {
	describe("INTENT_TYPES", () => {
		it("includes every supported intent", () => {
			expect(INTENT_TYPES).toEqual(
				expect.arrayContaining([
					"remember",
					"recall",
					"task",
					"question",
					"status",
					"list_view",
					"list_add",
					"list_clear",
					"edit_history",
					"greeting",
					"unknown",
				]),
			);
		});
	});

	describe("buildClassificationSystemPrompt", () => {
		it("includes few-shot examples for the core intents", () => {
			let prompt = buildClassificationSystemPrompt("");
			expect(prompt).toContain("Remember that trash day is Thursday");
			expect(prompt).toContain("What's the plumber's number?");
			expect(prompt).toContain("What's this week look like?");
		});

		it("includes edge-case routing rules", () => {
			let prompt = buildClassificationSystemPrompt("");
			expect(prompt).toContain("question");
			expect(prompt).toContain("unknown");
			expect(prompt).toContain("status");
			expect(prompt).toContain("FORWARDED EMAILS");
		});

		it("truncates context to 2000 characters", () => {
			let long = "x".repeat(5000);
			let prompt = buildClassificationSystemPrompt(long);
			expect(prompt).not.toContain("x".repeat(5000));
			expect(prompt).toContain("x".repeat(2000));
		});
	});

	describe("parseClassificationJson", () => {
		it("parses a clean JSON object", () => {
			let raw = '{"intent":"recall","confidence":0.8,"extractedData":{"content":"x","tags":[]}}';
			let result = parseClassificationJson(raw);
			expect(result.intent).toBe("recall");
			expect(result.confidence).toBe(0.8);
			expect(result.extractedData.content).toBe("x");
		});

		it("strips triple-backtick json code fences", () => {
			let raw = '```json\n{"intent":"remember","confidence":0.9,"extractedData":{"tags":[]}}\n```';
			let result = parseClassificationJson(raw);
			expect(result.intent).toBe("remember");
			expect(result.confidence).toBe(0.9);
		});

		it("strips bare triple-backtick fences", () => {
			let raw = '```\n{"intent":"task","confidence":0.7,"extractedData":{"tags":[]}}\n```';
			let result = parseClassificationJson(raw);
			expect(result.intent).toBe("task");
		});

		it("returns unknown/0 on bad JSON", () => {
			let result = parseClassificationJson("not json at all");
			expect(result.intent).toBe("unknown");
			expect(result.confidence).toBe(0);
			expect(result.extractedData.tags).toEqual([]);
		});

		it("returns unknown/0 on empty input", () => {
			let result = parseClassificationJson("");
			expect(result.intent).toBe("unknown");
			expect(result.confidence).toBe(0);
		});

		it("coerces an out-of-enum intent to unknown via schema catch", () => {
			let raw = '{"intent":"banana","confidence":0.5,"extractedData":{"tags":[]}}';
			let result = parseClassificationJson(raw);
			expect(result.intent).toBe("unknown");
		});
	});
});
