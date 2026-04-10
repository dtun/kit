import { createScorer } from "evalite";

export interface ExtractionExpected {
	keyFacts: string[];
}

export interface ScoreResult {
	score: number;
	metadata?: Record<string, unknown>;
}

export function scoreExtractionQuality(
	output: unknown,
	expected: ExtractionExpected | null | undefined,
): ScoreResult {
	if (!output || typeof output !== "string") return { score: 0 };
	if (!expected || !expected.keyFacts) return { score: 0 };

	let outputLower = output.toLowerCase();
	let found = 0;
	let missing: string[] = [];

	for (let fact of expected.keyFacts) {
		let words = fact
			.toLowerCase()
			.split(/\s+/)
			.filter((w) => w.length > 3);
		let wordHits = words.filter((w) => outputLower.includes(w)).length;

		if (words.length > 0 && wordHits >= Math.ceil(words.length * 0.5)) {
			found++;
		} else {
			missing.push(fact);
		}
	}

	let score = expected.keyFacts.length > 0 ? found / expected.keyFacts.length : 0;

	return {
		score,
		metadata: {
			found,
			total: expected.keyFacts.length,
			missing,
		},
	};
}

export let extractionQualityScorer = createScorer<string, string, ExtractionExpected>({
	name: "Extraction quality",
	description: "Checks if Kit extracted key facts from forwarded content",
	scorer: ({ output, expected }) => scoreExtractionQuality(output, expected),
});
