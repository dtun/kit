import type { MessageClassification } from "@domain/entities/intent";
import { createScorer } from "evalite";

export interface IntentExpected {
	intent: string;
	shouldExtract?: Record<string, string | undefined>;
}

export interface ScoreResult {
	score: number;
	metadata?: Record<string, unknown>;
}

export function scoreIntentAccuracy(
	output: MessageClassification | null | undefined,
	expected: IntentExpected | null | undefined,
): ScoreResult {
	if (!output || !expected) return { score: 0 };
	let match = output.intent === expected.intent;
	return {
		score: match ? 1 : 0,
		metadata: {
			expected: expected.intent,
			got: output.intent,
			confidence: output.confidence,
		},
	};
}

export let intentAccuracyScorer = createScorer<string, MessageClassification, IntentExpected>({
	name: "Intent accuracy",
	description: "Checks if Kit classified the user intent correctly",
	scorer: ({ output, expected }) => scoreIntentAccuracy(output, expected),
});
