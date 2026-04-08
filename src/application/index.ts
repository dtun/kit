// Ports
export type { IJournalRepository } from "./ports/journal-repository";
export type { IMessageGateway } from "./ports/message-gateway";
export type { IAIService } from "./ports/ai-service";

// Use cases
export { getHealth } from "./use-cases/get-health";
export type { HealthStatus } from "./use-cases/get-health";
export { createDailyLog } from "./use-cases/create-daily-log";
export { appendToLog } from "./use-cases/append-to-log";
export { readJournalEntry } from "./use-cases/read-journal-entry";
export { initializeJournal } from "./use-cases/initialize-journal";
