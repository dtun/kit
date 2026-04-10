import { createScorer } from "evalite";

export interface ScoreResult {
	score: number;
	metadata?: Record<string, unknown>;
}

let BANNED_PHRASES = [
	"i'm not sure what you're looking for",
	"can you tell me a bit more",
	"can you tell me more",
	"i don't have any context",
	"could you clarify",
	"i'm not sure how to help",
	"can you be more specific",
	"i don't understand",
	"what do you mean",
	"could you provide more details",
	"i need more information",
];

export function scoreNoConfusion(output: unknown): ScoreResult {
	if (!output || typeof output !== "string") return { score: 1 };

	let lower = output.toLowerCase();
	let violations = BANNED_PHRASES.filter((phrase) => lower.includes(phrase));

	return {
		score: violations.length === 0 ? 1 : 0,
		metadata: {
			violations,
			violationCount: violations.length,
		},
	};
}

export let noConfusionScorer = createScorer<string, string, unknown>({
	name: "No confusion language",
	description: "Ensures Kit never sounds confused or asks the user to explain themselves",
	scorer: ({ output }) => scoreNoConfusion(output),
});
