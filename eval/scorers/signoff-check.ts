import { createScorer } from "evalite";

export interface ScoreResult {
	score: number;
	metadata?: Record<string, unknown>;
}

export function scoreSignoffCheck(output: unknown): ScoreResult {
	if (!output || typeof output !== "string") return { score: 0 };

	let trimmed = output.trim();
	let hasSignoff = trimmed.endsWith("— Kit") || trimmed.endsWith("- Kit");

	return {
		score: hasSignoff ? 1 : 0,
		metadata: {
			lastLine: trimmed.split("\n").pop() || "",
		},
	};
}

export let signoffCheckScorer = createScorer<string, string, unknown>({
	name: "Sign-off check",
	description: "Verifies Kit signs off replies with '— Kit'",
	scorer: ({ output }) => scoreSignoffCheck(output),
});
