// Existing exports from Sub-PRD 1
export type { FamilyMember, Channel } from "./entities/family-member";
export type { KitMessage, KitResponse } from "./entities/kit-message";
export type { JournalEntry } from "./entities/journal-entry";
export type { EditRecord, EditAction } from "./entities/edit-record";
export { KitDomainError, UnauthorizedSenderError, JournalEntryNotFoundError } from "./errors";

// New exports for Sub-PRD 2
export type { BulletEntry, BulletType, TaskState, Signifier } from "./entities/signifier";
export { createJournalPaths } from "./entities/journal-path";
export type { JournalPaths } from "./entities/journal-path";
export { parseBulletLine, serializeBullet } from "./entities/bullet-parser";
export {
	dailyLogTemplate,
	monthlyLogTemplate,
	futureLogTemplate,
	indexTemplate,
	editLogLine,
} from "./entities/templates";

// Sub-PRD 3
export type { IntentType, MessageClassification } from "./entities/intent";
export type { AuthorizationResult } from "./entities/authorization";
export { authorizeSender } from "./entities/authorization";
