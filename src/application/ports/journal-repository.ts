import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalEntry } from "@domain/entities/journal-entry";

export interface IJournalRepository {
	// Core CRUD
	read(path: string): Promise<JournalEntry | null>;
	write(path: string, content: string, reason: string): Promise<EditRecord>;
	append(path: string, content: string, reason: string): Promise<EditRecord>;
	delete(path: string, reason: string): Promise<EditRecord>;

	// Query
	list(prefix: string): Promise<string[]>;
	exists(path: string): Promise<boolean>;
	search(query: string, prefix?: string): Promise<JournalEntry[]>;

	// Edit log
	getEditLog(year: number, month: number, day: number): Promise<string>;
}
