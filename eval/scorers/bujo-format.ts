import { createScorer } from "evalite";

export interface ScoreResult {
	score: number;
	metadata?: Record<string, unknown>;
}

export function scoreBujoFormat(output: unknown): ScoreResult {
	if (!output || typeof output !== "string") return { score: 0 };

	let lines = output.split("\n").filter((l) => l.trim());
	let validLines = 0;
	let totalContentLines = 0;

	for (let line of lines) {
		let trimmed = line.trim();
		if (trimmed.startsWith("#")) continue;
		if (trimmed === "") continue;

		totalContentLines++;

		let isValid =
			trimmed.startsWith("- [ ] ") ||
			trimmed.startsWith("- [x] ") ||
			trimmed.startsWith("- [>] ") ||
			trimmed.startsWith("- [<] ") ||
			trimmed.startsWith("- [-] ") ||
			trimmed.startsWith("- [o] ") ||
			trimmed.startsWith("- ") ||
			trimmed.startsWith("! ") ||
			trimmed.startsWith("* ") ||
			line.startsWith("  ");

		if (isValid) validLines++;
	}

	let score = totalContentLines > 0 ? validLines / totalContentLines : 0;

	return {
		score,
		metadata: {
			validLines,
			totalContentLines,
			invalidLines: totalContentLines - validLines,
		},
	};
}

export let bujoFormatScorer = createScorer<string, string, unknown>({
	name: "Bujo format",
	description: "Checks if journal entries use valid bullet journal signifiers",
	scorer: ({ output }) => scoreBujoFormat(output),
});
