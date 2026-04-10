import type { IAIService } from "@application/ports/ai-service";
import type { IntentType, MessageClassification } from "@domain/entities/intent";
import { z } from "zod";

let CompletionResponse = z.object({
	response: z.string().optional(),
	content: z.string().optional(),
});

let INTENT_TYPES: IntentType[] = [
	"remember",
	"recall",
	"task",
	"question",
	"status",
	"list_view",
	"list_add",
	"list_clear",
	"edit_history",
	"greeting",
	"unknown",
];

let ClassificationResponse = z.object({
	intent: z.enum(INTENT_TYPES as [IntentType, ...IntentType[]]).catch("unknown"),
	confidence: z.number().min(0).max(1).catch(0.5),
	extractedData: z
		.object({
			content: z.string().optional(),
			category: z.string().optional(),
			person: z.string().optional(),
			date: z.string().optional(),
			tags: z.array(z.string()).catch([]),
		})
		.catch({ tags: [] }),
});

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
		return parsed.data.response || parsed.data.content || "";
	}

	async classifyIntent(userMessage: string, context: string): Promise<MessageClassification> {
		let systemPrompt = [
			"You are an intent classifier for Kit, a family AI assistant.",
			"Classify the user's message into exactly one intent.",
			"",
			"Intents and examples:",
			'- remember: "Remember that trash day is Thursday" / "The WiFi password is sunflower42" / "Our plumber is Bob at 555-1234"',
			'- recall: "What\'s the plumber\'s number?" / "When is trash day?" / "What did I tell you about the dentist?"',
			'- task: "Add call the dentist to my list" / "Remind me to buy milk" / "I need to fix the fence"',
			'- question: "What should I make for dinner?" / "How\'s the weather?" / "What\'s a good gift for mom?"',
			'- status: "What\'s this week look like?" / "Give me a daily update" / "What\'s going on today?" / "What\'s up?"',
			'- list_view: "Show me the grocery list" / "What\'s on my todo list?"',
			'- list_add: "Add milk and eggs to the grocery list" / "Put laundry on the list"',
			'- list_clear: "Clear the grocery list" / "Reset my todo list"',
			'- edit_history: "What changes did you make today?" / "Show me your edits" / "What did you do?"',
			'- greeting: "Hey Kit" / "Good morning" / "Thanks!" / "How are you?"',
			"- unknown: Only if you genuinely cannot classify",
			"",
			'IMPORTANT: If ambiguous, prefer "question" over "unknown". Kit can always answer.',
			'IMPORTANT: "What\'s up?" or "What\'s going on?" = status, not greeting.',
			"IMPORTANT: If the user mentions a specific thing they told Kit before = recall, not question.",
			"",
			"FORWARDED EMAILS:",
			'When a message contains "User instruction:" + "Forwarded email from:", the user forwarded an email and added their own note.',
			'- "Note this date for me!" + forwarded event → remember (extract the event date and details)',
			'- "Can you handle this?" + forwarded request → task',
			'- "What do you think?" + forwarded content → question',
			'- "FYI" or no instruction + forward → remember (store the key info)',
			"- Always extract: who sent it, what it's about, any dates/times, any action items",
			"",
			"Respond with ONLY a JSON object (no markdown, no backticks):",
			'{"intent":"<intent>","confidence":<0-1>,"extractedData":{"content":"<core info>","category":"<list name or tag>","person":"<name if mentioned>","date":"<ISO date if mentioned>","tags":["<tags>"]}}',
			"",
			"Context from Kit's journal (for reference, don't classify based on this):",
			context.slice(0, 2000),
		].join("\n");

		let raw = await this.complete(systemPrompt, userMessage);

		try {
			let cleaned = raw
				.replace(/```json\s*/g, "")
				.replace(/```\s*/g, "")
				.trim();
			let json = JSON.parse(cleaned);
			return ClassificationResponse.parse(json);
		} catch (err) {
			console.error(
				`[DIAG] classifier parse failed. raw response (first 800 chars): ${JSON.stringify((raw || "").slice(0, 800))}`,
			);
			console.error(`[DIAG] classifier parse error: ${err instanceof Error ? err.message : err}`);
			console.error(
				`[DIAG] classifier userMessage (first 600 chars): ${JSON.stringify(userMessage.slice(0, 600))}`,
			);
			return {
				intent: "unknown",
				confidence: 0,
				extractedData: { tags: [] },
			};
		}
	}
}
