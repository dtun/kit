import { createScorer } from "evalite";

export interface ScoreResult {
	score: number;
	metadata?: Record<string, unknown>;
}

// Heuristic tone scoring — brevity + no markdown + signoff + sentence count.
// LLM-as-judge upgrade is deferred to a later session.
export function scoreToneCheck(output: unknown): ScoreResult {
	if (!output || typeof output !== "string") return { score: 0 };

	let text = output;
	let sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length;
	let hasMarkdown = /[*_#`[\]]/.test(text);
	let isBrief = sentences > 0 && sentences <= 6;
	let hasSignoff = text.includes("— Kit") || text.includes("- Kit");

	let score = 0;
	if (isBrief) score += 0.3;
	if (!hasMarkdown) score += 0.3;
	if (hasSignoff) score += 0.2;
	if (sentences >= 1) score += 0.2;

	return {
		score: Math.min(1, score),
		metadata: {
			sentences,
			hasMarkdown,
			isBrief,
			hasSignoff,
		},
	};
}

export let toneCheckScorer = createScorer<string, string, unknown>({
	name: "Tone check",
	description: "Heuristic: reply is brief, plain-text, and signed off as Kit",
	scorer: ({ output }) => scoreToneCheck(output),
});
