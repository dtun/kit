import type { ToolDefinition } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import { serializeBullet } from "@domain/entities/bullet-parser";
import type { JournalPaths } from "@domain/entities/journal-path";
import type { BulletEntry } from "@domain/entities/signifier";

// ---------------------------------------------------------------------------
// The bujo tool surface — defined ONCE here so the agentic loop (#25) and a
// future MCP server (#14) can serve the same tools.
//
// Memory-writes only: add_task / add_event / add_note / add_to_future_log,
// plus recall / search for reading existing memory before writing. NO
// external-side-effect tools (calendar create / send / print) — those route
// through the approval boundary (#10), not built here. Printing lives in
// print-receipt.ts, behind the member's-own-words rule.
// ---------------------------------------------------------------------------

export const BUJO_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
	{
		name: "search",
		description:
			"Search the existing journal for entries matching a query. ALWAYS call this before writing, so you don't duplicate something already recorded.",
		input_schema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Keywords to search for in the journal." },
			},
			required: ["query"],
		},
	},
	{
		name: "recall",
		description:
			"Recall related entries from the journal (alias for search). Use to check what's already known about a person, event, or topic before adding new entries.",
		input_schema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Keywords to recall from the journal." },
			},
			required: ["query"],
		},
	},
	{
		name: "add_task",
		description:
			"Add an actionable task to today's daily log (e.g. 'sign the permission slip'). Include @person to attribute it and #tag to categorize it.",
		input_schema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The task text. May contain @person and #tag markers.",
				},
			},
			required: ["content"],
		},
	},
	{
		name: "add_event",
		description:
			"Add a dated/timed event to today's daily log (e.g. 'soccer game at 10am'). Include @person and #tag as appropriate.",
		input_schema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The event text. May contain @person and #tag markers.",
				},
			},
			required: ["content"],
		},
	},
	{
		name: "add_note",
		description:
			"Add a plain note / fact to today's daily log (e.g. 'teacher prefers email contact'). Include @person and #tag as appropriate.",
		input_schema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The note text. May contain @person and #tag markers.",
				},
			},
			required: ["content"],
		},
	},
	{
		name: "add_to_future_log",
		description:
			"Record something happening on a specific future date in the future log (e.g. an upcoming trip, appointment, or deadline). Use ISO dates (YYYY-MM-DD) when possible.",
		input_schema: {
			type: "object",
			properties: {
				content: { type: "string", description: "What is happening on that date." },
				date: { type: "string", description: "The date it happens (ISO YYYY-MM-DD preferred)." },
			},
			required: ["content", "date"],
		},
	},
];

export interface BujoToolDeps {
	journal: IJournalRepository;
	paths: JournalPaths;
	memberName: string;
}

/** A handler takes the model's tool input and returns a text result for the model. */
export type BujoToolHandler = (input: Record<string, unknown>) => Promise<string>;

export interface BujoToolHandlers {
	add_task: BujoToolHandler;
	add_event: BujoToolHandler;
	add_note: BujoToolHandler;
	add_to_future_log: BujoToolHandler;
	recall: BujoToolHandler;
	search: BujoToolHandler;
	/** Records the names of write-tools invoked, in order, for loop reporting. */
	readonly writes: string[];
	/** Dispatch a tool by name. Throws on unknown tools. */
	run(name: string, input: Record<string, unknown>): Promise<string>;
}

function str(input: Record<string, unknown>, key: string): string {
	let v = input[key];
	return typeof v === "string" ? v : "";
}

function buildBullet(
	type: BulletEntry["type"],
	state: BulletEntry["state"],
	content: string,
): BulletEntry {
	let person: string | undefined;
	let tags: string[] = [];
	let personMatch = content.match(/@(\w+)/);
	if (personMatch) person = personMatch[1];
	for (let m of content.matchAll(/#(\w+)/g)) tags.push(m[1]);
	return { type, state, signifiers: [], content, person, tags };
}

export function createBujoToolHandlers(deps: BujoToolDeps, now: Date): BujoToolHandlers {
	let { journal, paths, memberName } = deps;
	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let d = now.getDate();
	let dailyPath = paths.dailyLog(y, m, d);
	let writes: string[] = [];

	async function appendBullet(
		toolName: string,
		type: BulletEntry["type"],
		state: BulletEntry["state"],
		content: string,
	): Promise<string> {
		let entry = buildBullet(type, state, content);
		let line = serializeBullet(entry);
		await journal.append(dailyPath, `${line}\n`, `${memberName}: ${toolName} — ${content}`);
		writes.push(toolName);
		return `Recorded in today's log: ${line}`;
	}

	async function searchJournal(input: Record<string, unknown>): Promise<string> {
		let query = str(input, "query");
		let results = await journal.search(query);
		if (results.length === 0) {
			return `No existing journal entries found for "${query}".`;
		}
		return results
			.slice(0, 5)
			.map((r) => `[${r.path}]:\n${r.content}`)
			.join("\n\n---\n\n");
	}

	let handlers: BujoToolHandlers = {
		add_task: (input) => appendBullet("add_task", "task", "open", str(input, "content")),
		add_event: (input) => appendBullet("add_event", "event", undefined, str(input, "content")),
		add_note: (input) => appendBullet("add_note", "note", undefined, str(input, "content")),
		add_to_future_log: async (input) => {
			let content = str(input, "content");
			let date = str(input, "date");
			let line = `- [o] ${content} (${date})`;
			await journal.append(
				paths.futureLog(),
				`${line}\n`,
				`${memberName}: add_to_future_log — ${content}`,
			);
			writes.push("add_to_future_log");
			return `Recorded in the future log: ${line}`;
		},
		recall: searchJournal,
		search: searchJournal,
		writes,
		async run(name, input) {
			switch (name) {
				case "add_task":
					return handlers.add_task(input);
				case "add_event":
					return handlers.add_event(input);
				case "add_note":
					return handlers.add_note(input);
				case "add_to_future_log":
					return handlers.add_to_future_log(input);
				case "recall":
					return handlers.recall(input);
				case "search":
					return handlers.search(input);
				default:
					throw new Error(`Unknown bujo tool: ${name}`);
			}
		},
	};

	return handlers;
}
