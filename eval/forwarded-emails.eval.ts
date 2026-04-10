import { evalite } from "evalite";
import { forwardedEmailDataset } from "./datasets/forwarded-emails";
import { processForward } from "./helpers/process-forward";
import { extractionQualityScorer } from "./scorers/extraction-quality";
import { noConfusionScorer } from "./scorers/no-confusion";

evalite("Forwarded email handling", {
	data: () =>
		forwardedEmailDataset.map((tc) => ({
			input: tc.input,
			expected: { keyFacts: tc.expected.keyFacts },
		})),
	task: async (input) => processForward(input),
	scorers: [extractionQualityScorer, noConfusionScorer],
});
