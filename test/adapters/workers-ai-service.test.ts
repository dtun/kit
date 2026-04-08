import { WorkersAIService } from "@adapters/ai/workers-ai-service";
import { describe, expect, it, vi } from "vitest";

function createMockAi(response: string) {
	return {
		run: vi.fn().mockResolvedValue({ response }),
	} as unknown as Ai;
}

describe("WorkersAIService", () => {
	describe("classifyIntent", () => {
		it("includes few-shot examples in the system prompt", async () => {
			const mockAi = createMockAi('{"intent":"remember","confidence":0.9,"extractedData":{"tags":[]}}');
			const service = new WorkersAIService(mockAi, "test-model");

			await service.classifyIntent("Remember that trash day is Thursday", "");

			const call = (mockAi.run as ReturnType<typeof vi.fn>).mock.calls[0];
			const systemPrompt = call[1].messages[0].content;

			expect(systemPrompt).toContain("Remember that trash day is Thursday");
			expect(systemPrompt).toContain("What's the plumber's number?");
			expect(systemPrompt).toContain("What's this week look like?");
		});

		it("includes edge case rules in the system prompt", async () => {
			const mockAi = createMockAi('{"intent":"status","confidence":0.9,"extractedData":{"tags":[]}}');
			const service = new WorkersAIService(mockAi, "test-model");

			await service.classifyIntent("What's up?", "");

			const call = (mockAi.run as ReturnType<typeof vi.fn>).mock.calls[0];
			const systemPrompt = call[1].messages[0].content;

			expect(systemPrompt).toContain("question");
			expect(systemPrompt).toContain("unknown");
			expect(systemPrompt).toContain("status");
		});

		it("truncates context to 2000 chars", async () => {
			const mockAi = createMockAi('{"intent":"greeting","confidence":0.9,"extractedData":{"tags":[]}}');
			const service = new WorkersAIService(mockAi, "test-model");

			const longContext = "x".repeat(5000);
			await service.classifyIntent("hello", longContext);

			const call = (mockAi.run as ReturnType<typeof vi.fn>).mock.calls[0];
			const systemPrompt = call[1].messages[0].content;

			// The full 5000-char context should NOT appear
			expect(systemPrompt).not.toContain("x".repeat(5000));
			// But a truncated version should
			expect(systemPrompt).toContain("x".repeat(2000));
		});

		it("returns parsed classification on valid JSON", async () => {
			const mockAi = createMockAi('{"intent":"recall","confidence":0.85,"extractedData":{"content":"plumber","tags":["home"]}}');
			const service = new WorkersAIService(mockAi, "test-model");

			const result = await service.classifyIntent("What's the plumber's number?", "");

			expect(result.intent).toBe("recall");
			expect(result.confidence).toBe(0.85);
			expect(result.extractedData.content).toBe("plumber");
		});

		it("falls back to unknown on invalid JSON", async () => {
			const mockAi = createMockAi("This is not JSON at all");
			const service = new WorkersAIService(mockAi, "test-model");

			const result = await service.classifyIntent("something", "");

			expect(result.intent).toBe("unknown");
			expect(result.confidence).toBe(0);
		});
	});
});
