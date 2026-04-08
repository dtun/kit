import { z } from "zod";
import type { IAIService } from "@application/ports/ai-service";
import type { IntentType, MessageClassification } from "@domain/entities/intent";

const CompletionResponse = z.object({
	response: z.string().optional(),
	content: z.string().optional(),
});

const INTENT_TYPES: IntentType[] = [
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

const ClassificationResponse = z.object({
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
		const raw = await this.ai.run(this.model as any, {
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
		});

		const parsed = CompletionResponse.safeParse(raw);
		if (!parsed.success) return "";
		return parsed.data.response || parsed.data.content || "";
	}

	async classifyIntent(
		userMessage: string,
		context: string,
	): Promise<MessageClassification> {
		const systemPrompt = [
			`You are an intent classifier for a family AI assistant called Kit.`,
			`Classify the user's message into exactly one intent.`,
			``,
			`Intents:`,
			`- remember: User wants Kit to store a fact, preference, or piece of info`,
			`- recall: User wants Kit to retrieve something it was told before`,
			`- task: User wants to add a task or to-do item`,
			`- question: User is asking a question that needs an answer`,
			`- status: User wants a daily/weekly update or summary`,
			`- list_view: User wants to see a list (grocery, todo, etc.)`,
			`- list_add: User wants to add items to a specific list`,
			`- list_clear: User wants to clear or reset a list`,
			`- edit_history: User wants to see what Kit has changed recently`,
			`- greeting: Casual hello or chat`,
			`- unknown: Can't determine intent`,
			``,
			`Respond with ONLY a JSON object, no markdown, no backticks:`,
			`{"intent":"<intent>","confidence":<0-1>,"extractedData":{"content":"<core info>","category":"<tag>","person":"<name>","date":"<ISO date if mentioned>","tags":["<tag1>"]}}`,
			``,
			`Context from Kit's journal:`,
			context,
		].join("\n");

		const raw = await this.complete(systemPrompt, userMessage);

		try {
			const cleaned = raw
				.replace(/```json\s*/g, "")
				.replace(/```\s*/g, "")
				.trim();
			const json = JSON.parse(cleaned);
			return ClassificationResponse.parse(json);
		} catch {
			return {
				intent: "unknown",
				confidence: 0,
				extractedData: { tags: [] },
			};
		}
	}
}
