import type { IJournalRepository } from "@application/ports/journal-repository";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalEntry } from "@domain/entities/journal-entry";

export class R2JournalRepository implements IJournalRepository {
	constructor(private bucket: R2Bucket) {}

	async read(_path: string): Promise<JournalEntry | null> {
		throw new Error("Not implemented — see Sub-PRD 2");
	}

	async write(_path: string, _content: string, _reason: string): Promise<EditRecord> {
		throw new Error("Not implemented — see Sub-PRD 2");
	}

	async list(_prefix: string): Promise<string[]> {
		throw new Error("Not implemented — see Sub-PRD 2");
	}

	async delete(_path: string, _reason: string): Promise<EditRecord> {
		throw new Error("Not implemented — see Sub-PRD 2");
	}

	async search(_query: string): Promise<JournalEntry[]> {
		throw new Error("Not implemented — see Sub-PRD 2");
	}
}
