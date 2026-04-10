import {
	CompletionResponse,
	buildClassificationSystemPrompt,
	parseClassificationJson,
} from "@adapters/ai/intent-prompt";
import type { IAIService } from "@application/ports/ai-service";
import type { MessageClassification } from "@domain/entities/intent";

export class WorkersAIService implements IAIService {
	private ai: Ai;
	private model: string;

	constructor(ai: Ai, model: string) {
		this.ai = ai;
		this.model = model;
	}

	async complete(systemPrompt: string, userMessage: string): Promise<string> {
		// Model name is dynamic from config — Cloudflare types expect a string literal union
		// biome-ignore lint/suspicious/noExplicitAny: ai.run() requires a literal model name type
		let raw = await this.ai.run(this.model as any, {
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
		});

		let parsed = CompletionResponse.safeParse(raw);
		if (!parsed.success) return "";
		let response = parsed.data.response;
		if (typeof response === "object" && response !== null) {
			return JSON.stringify(response);
		}
		return response || parsed.data.content || "";
	}

	async classifyIntent(userMessage: string, context: string): Promise<MessageClassification> {
		let systemPrompt = buildClassificationSystemPrompt(context);
		let raw = await this.complete(systemPrompt, userMessage);
		return parseClassificationJson(raw);
	}
}
