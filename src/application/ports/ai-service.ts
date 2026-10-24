import type { MessageClassification } from "@domain/entities/intent";

// ---------------------------------------------------------------------------
// Tool-use turn types (provider-agnostic).
//
// The agentic loop lives in the application layer; the adapter performs ONE
// model turn at a time. These types describe a single turn's worth of
// conversation so the use-case can drive the loop without importing the
// Anthropic SDK. They map cleanly onto Anthropic's message/content blocks.
// ---------------------------------------------------------------------------

/** A tool Claude may call, mirroring Anthropic's `{name, description, input_schema}`. */
export interface ToolDefinition {
	readonly name: string;
	readonly description: string;
	readonly input_schema: Record<string, unknown>;
}

/** A request from the model to invoke a tool. */
export interface ToolUseRequest {
	readonly id: string;
	readonly name: string;
	readonly input: Record<string, unknown>;
}

/** The result of running a tool, fed back to the model on the next turn. */
export interface ToolResult {
	readonly toolUseId: string;
	readonly content: string;
	readonly isError?: boolean;
}

/**
 * One turn in the running conversation. `assistant` turns carry the model's
 * raw output (text + tool-use requests); `tool` turns carry the results we
 * produced. The first turn the use-case sends is always a `user` turn.
 */
export type ToolTurnMessage =
	| { readonly role: "user"; readonly text: string }
	| {
			readonly role: "assistant";
			readonly text: string;
			readonly toolUses: readonly ToolUseRequest[];
			readonly providerContent?: unknown;
	  }
	| { readonly role: "tool"; readonly results: readonly ToolResult[] };

/** The model's output for a single turn. */
export interface ToolTurnResult {
	/** Assistant text emitted this turn (may be empty when only calling tools). */
	readonly text: string;
	/** Tools the model wants to run before continuing. */
	readonly toolUses: readonly ToolUseRequest[];
	/** Why the model stopped — `"tool_use"` means run the tools and loop. */
	readonly stopReason: string | null;
	/**
	 * The provider's native assistant content for this turn. Opaque to the
	 * application layer: copy it onto the assistant `ToolTurnMessage` unchanged,
	 * and the adapter that produced it replays it verbatim next turn. Providers
	 * that require signed reasoning blocks to survive a tool-use conversation
	 * (Claude's thinking blocks) depend on this.
	 */
	readonly providerContent?: unknown;
}

export interface IAIService {
	complete(systemPrompt: string, userMessage: string): Promise<string>;
	classifyIntent(userMessage: string, context: string): Promise<MessageClassification>;
	/**
	 * Perform ONE tool-using model turn. Given a system prompt, the running
	 * message list, and the available tools, return the model's output blocks.
	 * The application-layer agentic loop calls this repeatedly, executing any
	 * requested tools and feeding results back, until the model stops asking.
	 *
	 * Adapters whose model is too weak for tool use (e.g. Workers AI / llama)
	 * may throw to signal the agentic path is unavailable.
	 */
	runToolTurn(
		systemPrompt: string,
		messages: readonly ToolTurnMessage[],
		tools: readonly ToolDefinition[],
	): Promise<ToolTurnResult>;
}
