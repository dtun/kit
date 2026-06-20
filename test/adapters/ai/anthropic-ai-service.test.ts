import { AnthropicAIService } from "@adapters/ai/anthropic-ai-service";
import type { IAIService } from "@application/ports/ai-service";
import type { MessageClassification } from "@domain/entities/intent";
import { describe, expect, it, vi } from "vitest";

type CreateArgs = Parameters<import("@anthropic-ai/sdk").default["messages"]["create"]>[0];

function makeFakeAnthropic(create: ReturnType<typeof vi.fn>) {
	return { messages: { create } } as unknown as import("@anthropic-ai/sdk").default;
}

function textResponse(text: string) {
	return {
		content: [{ type: "text", text }],
	};
}

describe("AnthropicAIService", () => {
	describe("complete", () => {
		it("calls the SDK with the claude-opus-4-8 model and adaptive thinking", async () => {
			let create = vi.fn().mockResolvedValue(textResponse("done"));
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			await service.complete("you are kit", "hello");

			expect(create).toHaveBeenCalledTimes(1);
			let args = create.mock.calls[0][0] as CreateArgs;
			expect(args.model).toBe("claude-opus-4-8");
			expect(args.thinking).toEqual({ type: "adaptive" });
		});

		it("sends the system prompt and user message to the SDK", async () => {
			let create = vi.fn().mockResolvedValue(textResponse("done"));
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			await service.complete("you are kit", "hello");

			let args = create.mock.calls[0][0] as CreateArgs;
			expect(args.system).toBe("you are kit");
			expect(args.messages).toEqual([{ role: "user", content: "hello" }]);
		});

		it("does not send budget_tokens, temperature, top_p, or top_k", async () => {
			let create = vi.fn().mockResolvedValue(textResponse("done"));
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			await service.complete("sys", "user");

			let args = create.mock.calls[0][0] as Record<string, unknown>;
			expect(args.thinking).not.toHaveProperty("budget_tokens");
			expect(args).not.toHaveProperty("temperature");
			expect(args).not.toHaveProperty("top_p");
			expect(args).not.toHaveProperty("top_k");
		});

		it("sets a max_tokens suitable for digests", async () => {
			let create = vi.fn().mockResolvedValue(textResponse("done"));
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			await service.complete("sys", "user");

			let args = create.mock.calls[0][0] as CreateArgs;
			expect(args.max_tokens).toBe(4000);
		});

		it("extracts and concatenates text blocks from the response", async () => {
			let create = vi.fn().mockResolvedValue({
				content: [
					{ type: "thinking", thinking: "hmm" },
					{ type: "text", text: "Hello " },
					{ type: "text", text: "world" },
				],
			});
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			let result = await service.complete("sys", "user");

			expect(result).toBe("Hello world");
		});

		it("throws when the response contains no text blocks", async () => {
			let create = vi.fn().mockResolvedValue({
				content: [{ type: "thinking", thinking: "hmm" }],
			});
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			await expect(service.complete("sys", "user")).rejects.toThrow(/empty|no text/i);
		});
	});

	describe("classifyIntent", () => {
		it("delegates to the injected fallback service (keeps classification cheap)", async () => {
			let create = vi.fn().mockResolvedValue(textResponse("should not be used"));
			let classification: MessageClassification = {
				intent: "recall",
				confidence: 0.9,
				extractedData: { tags: [] },
			};
			let fallback: IAIService = {
				complete: vi.fn(),
				classifyIntent: vi.fn().mockResolvedValue(classification),
			};
			let service = new AnthropicAIService(makeFakeAnthropic(create), fallback);

			let result = await service.classifyIntent("what's the plumber?", "ctx");

			expect(result).toBe(classification);
			expect(fallback.classifyIntent).toHaveBeenCalledWith("what's the plumber?", "ctx");
			expect(create).not.toHaveBeenCalled();
		});

		it("throws if no fallback service is configured", async () => {
			let create = vi.fn();
			let service = new AnthropicAIService(makeFakeAnthropic(create));

			await expect(service.classifyIntent("hi", "")).rejects.toThrow(/fallback|classif/i);
		});
	});
});
