import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { DateContext } from "@domain/entities/date-context";
import type { JournalPaths } from "@domain/entities/journal-path";
import { KIT_PERSONA } from "@domain/entities/persona";

export interface AnswerQuestionDeps {
	journal: IJournalRepository;
	ai: IAIService;
	paths: JournalPaths;
	coldStartRules?: readonly string[];
}

export async function answerQuestion(
	deps: AnswerQuestionDeps,
	question: string,
	memberName: string,
	dateCtx: DateContext,
): Promise<string> {
	let { journal, ai, paths } = deps;

	let todayLog = await journal.read(paths.dailyLog(dateCtx.year, dateCtx.month, dateCtx.day));
	let searchResults = await journal.search(question);
	let topResults = searchResults.slice(0, 3);

	let contextParts: string[] = [];
	if (todayLog) contextParts.push(`TODAY'S LOG:\n${todayLog.content}`);
	if (topResults.length > 0) {
		contextParts.push(
			`RELATED JOURNAL ENTRIES:\n${topResults.map((r) => `[${r.path}]:\n${r.content}`).join("\n---\n")}`,
		);
	}

	let journalContext = contextParts.join("\n\n") || "No relevant journal entries found.";

	let systemPrompt = [
		`You are ${KIT_PERSONA.name}, a family assistant for ${memberName}.`,
		`Today is ${dateCtx.dayOfWeek}, ${dateCtx.now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
		"",
		"The user asked a question. Answer using the journal context below if relevant.",
		"If the journal doesn't have the answer, use your general knowledge but note that it's not from the journal.",
		"",
		"Journal context:",
		journalContext,
		"",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		...(deps.coldStartRules && deps.coldStartRules.length > 0
			? ["", "COLD START BEHAVIOR:", ...deps.coldStartRules.map((r) => `- ${r}`)]
			: []),
	].join("\n");

	return ai.complete(systemPrompt, question);
}
