import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalEntry } from "@domain/entities/journal-entry";

export interface IJournalRepository {
	read(path: string): Promise<JournalEntry | null>;
	write(path: string, content: string, reason: string): Promise<EditRecord>;
	list(prefix: string): Promise<string[]>;
	delete(path: string, reason: string): Promise<EditRecord>;
	search(query: string): Promise<JournalEntry[]>;
}
