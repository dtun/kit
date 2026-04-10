import { WorkersAIService } from "@adapters/ai/workers-ai-service";
import { describe, expect, it, vi } from "vitest";

function createMockAi(response: string) {
	return {
		run: vi.fn().mockResolvedValue({ response }),
	} as unknown as Ai;
}

// Workers AI sometimes returns the `response` field as an already-parsed
// object when the model emits structured output (e.g., JSON-only prompts).
function createMockAiWithObjectResponse(response: object) {
	return {
		run: vi.fn().mockResolvedValue({ response }),
	} as unknown as Ai;
}

describe("WorkersAIService", () => {
	describe("classifyIntent", () => {
		it("includes few-shot examples in the system prompt", async () => {
			let mockAi = createMockAi(
				'{"intent":"remember","confidence":0.9,"extractedData":{"tags":[]}}',
			);
			let service = new WorkersAIService(mockAi, "test-model");

			await service.classifyIntent("Remember that trash day is Thursday", "");

			let call = (mockAi.run as ReturnType<typeof vi.fn>).mock.calls[0];
			let systemPrompt = call[1].messages[0].content;

			expect(systemPrompt).toContain("Remember that trash day is Thursday");
			expect(systemPrompt).toContain("What's the plumber's number?");
			expect(systemPrompt).toContain("What's this week look like?");
		});

		it("includes edge case rules in the system prompt", async () => {
			let mockAi = createMockAi('{"intent":"status","confidence":0.9,"extractedData":{"tags":[]}}');
			let service = new WorkersAIService(mockAi, "test-model");

			await service.classifyIntent("What's up?", "");

			let call = (mockAi.run as ReturnType<typeof vi.fn>).mock.calls[0];
			let systemPrompt = call[1].messages[0].content;

			expect(systemPrompt).toContain("question");
			expect(systemPrompt).toContain("unknown");
			expect(systemPrompt).toContain("status");
		});

		it("truncates context to 2000 chars", async () => {
			let mockAi = createMockAi(
				'{"intent":"greeting","confidence":0.9,"extractedData":{"tags":[]}}',
			);
			let service = new WorkersAIService(mockAi, "test-model");

			let longContext = "x".repeat(5000);
			await service.classifyIntent("hello", longContext);

			let call = (mockAi.run as ReturnType<typeof vi.fn>).mock.calls[0];
			let systemPrompt = call[1].messages[0].content;

			// The full 5000-char context should NOT appear
			expect(systemPrompt).not.toContain("x".repeat(5000));
			// But a truncated version should
			expect(systemPrompt).toContain("x".repeat(2000));
		});

		it("returns parsed classification on valid JSON", async () => {
			let mockAi = createMockAi(
				'{"intent":"recall","confidence":0.85,"extractedData":{"content":"plumber","tags":["home"]}}',
			);
			let service = new WorkersAIService(mockAi, "test-model");

			let result = await service.classifyIntent("What's the plumber's number?", "");

			expect(result.intent).toBe("recall");
			expect(result.confidence).toBe(0.85);
			expect(result.extractedData.content).toBe("plumber");
		});

		it("falls back to unknown on invalid JSON", async () => {
			let mockAi = createMockAi("This is not JSON at all");
			let service = new WorkersAIService(mockAi, "test-model");

			let result = await service.classifyIntent("something", "");

			expect(result.intent).toBe("unknown");
			expect(result.confidence).toBe(0);
		});

		it("returns parsed classification when Workers AI returns response as an object", async () => {
			let mockAi = createMockAiWithObjectResponse({
				intent: "remember",
				confidence: 0.95,
				extractedData: {
					content: "Combatives Belt Test on April 18th at 9am",
					category: "Events",
					person: "Jimi Clayton",
					date: "2026-04-18",
					tags: ["bjj", "events"],
				},
			});
			let service = new WorkersAIService(mockAi, "test-model");

			let result = await service.classifyIntent("forwarded email body", "");

			expect(result.intent).toBe("remember");
			expect(result.confidence).toBe(0.95);
			expect(result.extractedData.content).toBe("Combatives Belt Test on April 18th at 9am");
			expect(result.extractedData.date).toBe("2026-04-18");
		});
	});

	describe("complete", () => {
		it("returns the response when Workers AI returns a string", async () => {
			let mockAi = createMockAi("Hello there.");
			let service = new WorkersAIService(mockAi, "test-model");

			let result = await service.complete("system", "user");

			expect(result).toBe("Hello there.");
		});

		it("returns JSON-stringified response when Workers AI returns an object", async () => {
			let mockAi = createMockAiWithObjectResponse({ greeting: "hi", count: 3 });
			let service = new WorkersAIService(mockAi, "test-model");

			let result = await service.complete("system", "user");

			expect(result).toBe('{"greeting":"hi","count":3}');
		});
	});
});
