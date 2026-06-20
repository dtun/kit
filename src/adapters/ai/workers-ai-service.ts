import {
	CompletionResponse,
	buildClassificationSystemPrompt,
	parseClassificationJson,
} from "@adapters/ai/intent-prompt";
import type { IAIService } from "@application/ports/ai-service";
import type { MessageClassification } from "@domain/entities/intent";

// Workers AI occasionally wraps the generated text inside the object it returns
// (e.g. `{ response: "..." }` or `{ text: "..." }`). Pull out that text field so
// we never surface a raw JSON blob to the user.
const TEXT_FIELD_KEYS = ["response", "content", "text"];

function hasTextField(obj: Record<string, unknown>): boolean {
	return TEXT_FIELD_KEYS.some((key) => typeof obj[key] === "string");
}

function extractTextField(obj: Record<string, unknown>): string | undefined {
	for (let key of TEXT_FIELD_KEYS) {
		let value = obj[key];
		if (typeof value === "string" && value.length > 0) return value;
	}
	return undefined;
}

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
		if (!parsed.success) {
			throw new Error(
				`Workers AI response failed schema validation: ${JSON.stringify(raw).slice(0, 200)}`,
			);
		}
		let response = parsed.data.response;
		if (typeof response === "object" && response !== null) {
			let nestedText = extractTextField(response);
			if (nestedText) return nestedText;
			if (hasTextField(response)) {
				// The model wrapped its answer in a text field but left it empty —
				// treat it as an empty response rather than dumping the JSON wrapper.
				throw new Error(
					`Workers AI returned empty response: ${JSON.stringify(raw).slice(0, 200)}`,
				);
			}
			// No recognizable text field — the model emitted structured output
			// (e.g. a JSON-only classification). Hand back the JSON so internal
			// JSON consumers (classifyIntent) can parse it; user-facing callers
			// already guard against empty/structured output upstream.
			return JSON.stringify(response);
		}
		let text = response || parsed.data.content;
		if (!text) {
			throw new Error(`Workers AI returned empty response: ${JSON.stringify(raw).slice(0, 200)}`);
		}
		return text;
	}

	async classifyIntent(userMessage: string, context: string): Promise<MessageClassification> {
		let systemPrompt = buildClassificationSystemPrompt(context);
		let raw = await this.complete(systemPrompt, userMessage);
		return parseClassificationJson(raw);
	}
}
