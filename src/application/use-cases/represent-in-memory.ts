import type {
	IAIService,
	ToolResult,
	ToolTurnMessage,
	ToolUseRequest,
} from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { JournalPaths } from "@domain/entities/journal-path";
import { KIT_PERSONA } from "@domain/entities/persona";
import { BUJO_TOOL_DEFINITIONS, createBujoToolHandlers } from "./bujo-tools";

// ---------------------------------------------------------------------------
// The agentic "reasoner" path (#25). Instead of a single intent → single
// action switch, Claude decides how to represent an inbound fact in the bujo
// memory — possibly as several writes (event + task + future-log + tag) — and
// executes them via the bujo tools. The loop lives here in the application
// layer; the adapter only performs ONE model turn at a time.
// ---------------------------------------------------------------------------

// Hard cap on turns so a misbehaving model can't loop forever.
const MAX_TURNS = 12;

export interface RepresentInMemoryDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
	ai: IAIService;
	memberName: string;
	coldStartRules?: readonly string[];
}

export interface RepresentInMemoryResult {
	/** Names of the write-tools the agent invoked, in order. */
	readonly writes: string[];
	/** The model's final assistant text (used as the reply summary). */
	readonly summary: string;
	/** Daily-log / future-log paths touched by the writes. */
	readonly journalPaths: string[];
}

function buildSystemPrompt(memberName: string, coldStartRules?: readonly string[]): string {
	return [
		`You are ${KIT_PERSONA.name} (${KIT_PERSONA.fullName}), a family bullet-journal keeper.`,
		`${memberName} has sent you something to remember.`,
		"",
		"Your job: decide how to best represent this in the journal. A single message",
		"may deserve SEVERAL entries — for example a forwarded school email might become",
		"an event (the date), one or more tasks (a permission slip, a payment), and a",
		"future-log entry, all tagged with the relevant #topic and @person.",
		"",
		"Rules:",
		"- ALWAYS search/recall existing memory first so you don't duplicate entries.",
		"- Use add_task for actionable to-dos, add_event for dated/timed happenings,",
		"  add_note for plain facts, add_to_future_log for things on a specific future date.",
		"- Attribute with @person and categorize with #tag inside the content.",
		"- Only record what's genuinely useful. When you're done, reply with a short,",
		"  friendly confirmation of what you recorded.",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		...(coldStartRules && coldStartRules.length > 0
			? ["", "COLD START BEHAVIOR:", ...coldStartRules.map((r) => `- ${r}`)]
			: []),
	].join("\n");
}

export async function representInMemory(
	deps: RepresentInMemoryDeps,
	inboundText: string,
	now: Date,
): Promise<RepresentInMemoryResult> {
	let { journal, paths, ai, memberName, coldStartRules } = deps;

	let handlers = createBujoToolHandlers({ journal, paths, memberName }, now);
	let systemPrompt = buildSystemPrompt(memberName, coldStartRules);

	let messages: ToolTurnMessage[] = [{ role: "user", text: inboundText }];
	let summary = "";

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		let result = await ai.runToolTurn(systemPrompt, messages, BUJO_TOOL_DEFINITIONS);

		if (result.text) summary = result.text;

		// Record the assistant turn (text + any tool-use requests) verbatim.
		messages.push({
			role: "assistant",
			text: result.text,
			toolUses: result.toolUses,
			providerContent: result.providerContent,
		});

		if (result.stopReason !== "tool_use" || result.toolUses.length === 0) {
			break;
		}

		let results: ToolResult[] = [];
		for (let use of result.toolUses) {
			results.push(await runTool(handlers, use));
		}
		messages.push({ role: "tool", results });
	}

	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let d = now.getDate();
	let journalPaths: string[] = [];
	if (handlers.writes.some((w) => w !== "add_to_future_log")) {
		journalPaths.push(paths.dailyLog(y, m, d));
	}
	if (handlers.writes.includes("add_to_future_log")) {
		journalPaths.push(paths.futureLog());
	}

	return { writes: handlers.writes, summary, journalPaths };
}

async function runTool(
	handlers: ReturnType<typeof createBujoToolHandlers>,
	use: ToolUseRequest,
): Promise<ToolResult> {
	try {
		let content = await handlers.run(use.name, use.input);
		return { toolUseId: use.id, content };
	} catch (err) {
		return {
			toolUseId: use.id,
			content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
			isError: true,
		};
	}
}
