import type Anthropic from "@anthropic-ai/sdk";
import type { IAIService } from "@application/ports/ai-service";
import { ANTHROPIC_MODEL } from "@config";
import type { MessageClassification } from "@domain/entities/intent";

// Non-streaming digest/reply synthesis fits comfortably in a few thousand tokens.
const MAX_TOKENS = 4000;

/**
 * Claude-backed AI service — the reasoning brain for digests, replies, and
 * recall synthesis. Uses Claude Opus 4.8 with adaptive thinking.
 *
 * Classification stays on the cheap Workers AI path: pass that service as the
 * `fallback` so `classifyIntent` delegates to llama (dual-model architecture).
 */
export class AnthropicAIService implements IAIService {
	private client: Anthropic;
	private fallback?: IAIService;

	constructor(client: Anthropic, fallback?: IAIService) {
		this.client = client;
		this.fallback = fallback;
	}

	async complete(systemPrompt: string, userMessage: string): Promise<string> {
		let response = await this.client.messages.create({
			model: ANTHROPIC_MODEL,
			max_tokens: MAX_TOKENS,
			thinking: { type: "adaptive" },
			system: systemPrompt,
			messages: [{ role: "user", content: userMessage }],
		});

		let text = response.content
			.filter((block): block is Anthropic.TextBlock => block.type === "text")
			.map((block) => block.text)
			.join("");

		if (!text) {
			throw new Error(
				`Anthropic returned no text blocks: ${JSON.stringify(response.content).slice(0, 200)}`,
			);
		}

		return text;
	}

	async classifyIntent(userMessage: string, context: string): Promise<MessageClassification> {
		if (!this.fallback) {
			throw new Error(
				"AnthropicAIService.classifyIntent requires a fallback service (classification stays on Workers AI)",
			);
		}
		return this.fallback.classifyIntent(userMessage, context);
	}
}
