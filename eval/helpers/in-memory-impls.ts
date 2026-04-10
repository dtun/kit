// Re-export in-memory / mock adapter implementations from test/helpers
// so eval code has a single import site. Evals are consumers of the
// whole repo, not a clean-architecture layer, so crossing into test/
// is intentional and preferable to duplication.
export {
	InMemoryConversationStore,
	InMemoryJournalRepository,
	MockMessageGateway,
} from "../../test/helpers/mocks";
