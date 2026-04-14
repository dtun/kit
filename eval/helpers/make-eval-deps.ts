import { NodeWorkersAIService } from "@adapters/ai/node-workers-ai-service";
import type { ProcessInboundMessageDeps } from "@application/use-cases/process-inbound-message";
import { AI_MODEL } from "@config";
import type { FamilyMember } from "@domain/entities/family-member";
import { createJournalPaths } from "@domain/entities/journal-path";
import {
	InMemoryConversationStore,
	InMemoryJournalRepository,
	MockMessageGateway,
} from "./in-memory-impls";
import { seedJournal } from "./seed-journal";

// The eval runtime is Node (Evalite), not Cloudflare Workers, so we
// declare the narrow slice of `process` we need rather than pulling
// @types/node into the Workers-scoped tsconfig.
declare const process: { env: Record<string, string | undefined> };

export interface EvalDepsOptions {
	journalState?: "empty" | "seeded";
}

export interface EvalDeps extends ProcessInboundMessageDeps {
	journal: InMemoryJournalRepository;
	messenger: MockMessageGateway;
	conversationStore: InMemoryConversationStore;
	ai: NodeWorkersAIService;
}

let EVAL_FAMILY: FamilyMember[] = [
	{ name: "Eval User", contact: "eval@kit.test", channel: "email" },
];

let EVAL_KIT_CONFIG = {
	name: "Kit",
	email: "kit@kit.test",
};

export function makeEvalDeps(options: EvalDepsOptions = {}): EvalDeps {
	let apiToken = process.env.CLOUDFLARE_API_TOKEN || "";
	let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
	let model = process.env.CLOUDFLARE_AI_MODEL || AI_MODEL;

	let ai = new NodeWorkersAIService({ apiToken, accountId, model });
	let journal = new InMemoryJournalRepository();
	let messenger = new MockMessageGateway();
	let conversationStore = new InMemoryConversationStore();
	let paths = createJournalPaths("journal/");

	if (options.journalState === "seeded") {
		seedJournal(journal, paths);
	}

	return {
		journal,
		ai,
		messenger,
		paths,
		familyMembers: EVAL_FAMILY,
		kitConfig: EVAL_KIT_CONFIG,
		conversationStore,
	};
}
