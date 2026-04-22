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

// Sub-PRD 4
export type { Persona } from "./entities/persona";
export { KIT_PERSONA } from "./entities/persona";
export type { DateContext } from "./entities/date-context";
export { createDateContext } from "./entities/date-context";
export type { ConversationTurn } from "./entities/conversation-turn";

// Sub-PRD 5
export type { MigrationItem, MigrationResult } from "./entities/migration-result";
export type { DigestPreferences } from "./entities/digest-preferences";
export { DEFAULT_DIGEST_PREFERENCES } from "./entities/digest-preferences";
export type { ArchiveDecision } from "./entities/archive-policy";
export { shouldArchive, parseDateFromPath } from "./entities/archive-policy";

// Sub-PRD 9
export type {
	CalendarEvent,
	CalendarQuery,
	CalendarCreateRequest,
} from "./entities/calendar-event";
