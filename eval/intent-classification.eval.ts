import { evalite } from "evalite";
import { intentDataset } from "./datasets/intent-classification";
import { classifyIntent } from "./helpers/classify";
import { intentAccuracyScorer } from "./scorers/intent-accuracy";

evalite("Intent classification", {
	data: () =>
		intentDataset.map((tc) => ({
			input: tc.input,
			expected: { intent: tc.expected.intent },
		})),
	task: async (input) => classifyIntent(input),
	scorers: [intentAccuracyScorer],
});
