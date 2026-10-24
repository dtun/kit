import type Anthropic from "@anthropic-ai/sdk";
import type {
	IAIService,
	ToolDefinition,
	ToolTurnMessage,
	ToolTurnResult,
	ToolUseRequest,
} from "@application/ports/ai-service";
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

	async runToolTurn(
		systemPrompt: string,
		messages: readonly ToolTurnMessage[],
		tools: readonly ToolDefinition[],
	): Promise<ToolTurnResult> {
		let response = await this.client.messages.create({
			model: ANTHROPIC_MODEL,
			max_tokens: MAX_TOKENS,
			thinking: { type: "adaptive" },
			system: systemPrompt,
			tools: tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.input_schema as Anthropic.Tool.InputSchema,
			})),
			messages: messages.map(toAnthropicMessage),
		});

		let text = response.content
			.filter((block): block is Anthropic.TextBlock => block.type === "text")
			.map((block) => block.text)
			.join("");

		let toolUses: ToolUseRequest[] = response.content
			.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
			.map((block) => ({
				id: block.id,
				name: block.name,
				input: (block.input ?? {}) as Record<string, unknown>,
			}));

		return { text, toolUses, stopReason: response.stop_reason, providerContent: response.content };
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

// Map a provider-agnostic turn onto Anthropic's message shape. Per the tool-use
// loop: the assistant turn carries the full `content` (text + tool_use blocks),
// and a tool turn becomes a user message of `tool_result` blocks, each matching
// its originating `tool_use_id`. Anthropic requires thinking blocks to be passed
// back unchanged across a tool-use turn, so a turn that carries `providerContent`
// replays it verbatim instead of being rebuilt.
function toAnthropicMessage(message: ToolTurnMessage): Anthropic.MessageParam {
	if (message.role === "user") {
		return { role: "user", content: message.text };
	}

	if (message.role === "assistant") {
		if (message.providerContent) {
			return {
				role: "assistant",
				content: message.providerContent as Anthropic.ContentBlockParam[],
			};
		}

		let content: Anthropic.ContentBlockParam[] = [];
		if (message.text) content.push({ type: "text", text: message.text });
		for (let use of message.toolUses) {
			content.push({ type: "tool_use", id: use.id, name: use.name, input: use.input });
		}
		return { role: "assistant", content };
	}

	// tool results are delivered as a user message of tool_result blocks
	return {
		role: "user",
		content: message.results.map((r) => ({
			type: "tool_result",
			tool_use_id: r.toolUseId,
			content: r.content,
			...(r.isError ? { is_error: true } : {}),
		})),
	};
}
