import type { IJournalRepository } from "@application/ports/journal-repository";
import type { JournalEntry } from "@domain/entities/journal-entry";
import { JournalEntryNotFoundError } from "@domain/errors";

export interface ReadJournalEntryDeps {
	journal: IJournalRepository;
}

export async function readJournalEntry(
	deps: ReadJournalEntryDeps,
	path: string,
): Promise<JournalEntry> {
	const entry = await deps.journal.read(path);
	if (!entry) throw new JournalEntryNotFoundError(path);
	return entry;
}
