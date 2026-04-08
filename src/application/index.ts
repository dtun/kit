// Ports
export type { IJournalRepository } from "./ports/journal-repository";
export type { IMessageGateway } from "./ports/message-gateway";
export type { IAIService } from "./ports/ai-service";
export type { IConversationStore } from "./ports/conversation-store";

// Use cases
export { getHealth } from "./use-cases/get-health";
export type { HealthStatus } from "./use-cases/get-health";
export { createDailyLog } from "./use-cases/create-daily-log";
export { appendToLog } from "./use-cases/append-to-log";
export { readJournalEntry } from "./use-cases/read-journal-entry";
export { initializeJournal } from "./use-cases/initialize-journal";
export { processInboundMessage } from "./use-cases/process-inbound-message";
export type {
	ProcessingResult,
	ProcessInboundMessageDeps,
} from "./use-cases/process-inbound-message";
export { compileStatus } from "./use-cases/compile-status";
export type { CompileStatusDeps } from "./use-cases/compile-status";
export { recallFromJournal } from "./use-cases/recall-from-journal";
export type { RecallFromJournalDeps } from "./use-cases/recall-from-journal";
export { answerQuestion } from "./use-cases/answer-question";
export type { AnswerQuestionDeps } from "./use-cases/answer-question";
