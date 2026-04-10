import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import { KIT_PERSONA } from "@domain/entities/persona";

export interface RecallFromJournalDeps {
	journal: IJournalRepository;
	ai: IAIService;
	coldStartRules?: readonly string[];
}

export async function recallFromJournal(
	deps: RecallFromJournalDeps,
	query: string,
	memberName: string,
): Promise<string> {
	let { journal, ai } = deps;

	let results = await journal.search(query);

	if (results.length === 0) {
		return `I searched my journal for "${query}" but didn't find anything. If you told me about this before, it might have been worded differently \u2014 try rephrasing? ${KIT_PERSONA.signOff}`;
	}

	let topResults = results.slice(0, 5);
	let context = topResults.map((r) => `[${r.path}]:\n${r.content}`).join("\n\n---\n\n");

	let systemPrompt = [
		`You are ${KIT_PERSONA.name}. ${memberName} asked you to recall something.`,
		"",
		"Search results from Kit's journal:",
		context,
		"",
		"Rules:",
		"- Answer based ONLY on what's in the journal results above",
		"- Quote the relevant entry so they can see where it came from",
		"- If the results don't clearly answer the question, say so",
		"- Never fabricate information",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		...(deps.coldStartRules && deps.coldStartRules.length > 0
			? ["", "COLD START BEHAVIOR:", ...deps.coldStartRules.map((r) => `- ${r}`)]
			: []),
	].join("\n");

	return ai.complete(systemPrompt, `Recall: "${query}"`);
}
