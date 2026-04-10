import { processInboundMessage } from "@application/use-cases/process-inbound-message";
import type { Channel } from "@domain/entities/family-member";
import { type EvalDepsOptions, makeEvalDeps } from "./make-eval-deps";

// Runs Kit's full inbound pipeline and returns the body of the reply
// that was sent to the user. Used by cold-start and reply-quality evals.
export async function processMessageToReply(
	input: string,
	options: EvalDepsOptions = {},
): Promise<string> {
	let deps = makeEvalDeps(options);
	let channel: Channel = "email";

	await processInboundMessage(deps, {
		from: "eval@kit.test",
		channel,
		body: input,
		timestamp: new Date().toISOString(),
	});

	let last = deps.messenger.sentMessages.at(-1);
	return last?.body ?? "";
}
