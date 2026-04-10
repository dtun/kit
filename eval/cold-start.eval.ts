import { evalite } from "evalite";
import { coldStartDataset } from "./datasets/cold-start";
import { processMessageToReply } from "./helpers/process-message";
import { noConfusionScorer } from "./scorers/no-confusion";
import { signoffCheckScorer } from "./scorers/signoff-check";
import { toneCheckScorer } from "./scorers/tone-check";

evalite("Cold start behavior", {
	data: () =>
		coldStartDataset.map((tc) => ({
			input: tc.input,
			expected: undefined,
		})),
	task: async (input) => processMessageToReply(input, { journalState: "empty" }),
	scorers: [noConfusionScorer, signoffCheckScorer, toneCheckScorer],
});
