import type { MessageClassification } from "@domain/entities/intent";
import { makeEvalDeps } from "./make-eval-deps";

// Thin wrapper so eval suites can call the real classifier without
// constructing the full dependency graph each time.
export async function classifyIntent(
	input: string,
	context = "No journal context yet.",
): Promise<MessageClassification> {
	let { ai } = makeEvalDeps();
	return ai.classifyIntent(input, context);
}
