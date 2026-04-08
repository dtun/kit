import type { IJournalRepository } from "@application/ports/journal-repository";
import { JOURNAL_CONFIG } from "@config";
import type { EditAction, EditRecord } from "@domain/entities/edit-record";
import type { JournalEntry } from "@domain/entities/journal-entry";
import { createJournalPaths } from "@domain/entities/journal-path";
import { editLogLine } from "@domain/entities/templates";

export class R2JournalRepository implements IJournalRepository {
	private bucket: R2Bucket;
	private paths;

	constructor(bucket: R2Bucket) {
		this.bucket = bucket;
		this.paths = createJournalPaths(JOURNAL_CONFIG.rootPrefix);
	}

	async read(path: string): Promise<JournalEntry | null> {
		const object = await this.bucket.get(path);
		if (!object) return null;

		const content = await object.text();
		return {
			path,
			content,
			lastModified: object.uploaded.toISOString(),
		};
	}

	async write(path: string, content: string, reason: string): Promise<EditRecord> {
		await this.bucket.put(path, content);
		const record = this.makeEditRecord("create", path, reason);
		await this.logEdit(record);
		return record;
	}

	async append(path: string, content: string, reason: string): Promise<EditRecord> {
		const existing = await this.read(path);
		const newContent = existing ? existing.content + content : content;
		await this.bucket.put(path, newContent);
		const record = this.makeEditRecord("update", path, reason);
		await this.logEdit(record);
		return record;
	}

	async delete(path: string, reason: string): Promise<EditRecord> {
		await this.bucket.delete(path);
		const record = this.makeEditRecord("delete", path, reason);
		await this.logEdit(record);
		return record;
	}

	async list(prefix: string): Promise<string[]> {
		const listed = await this.bucket.list({ prefix });
		return listed.objects.map((obj) => obj.key);
	}

	async exists(path: string): Promise<boolean> {
		const head = await this.bucket.head(path);
		return head !== null;
	}

	async search(query: string, prefix?: string): Promise<JournalEntry[]> {
		const searchPrefix = prefix || JOURNAL_CONFIG.rootPrefix;
		const keys = await this.list(searchPrefix);
		const results: JournalEntry[] = [];
		const lowerQuery = query.toLowerCase();

		// Simple content search — iterate files and check content
		// Future optimization: build a search index
		for (const key of keys) {
			if (key.endsWith("/")) continue; // skip directories
			const entry = await this.read(key);
			if (entry?.content.toLowerCase().includes(lowerQuery)) {
				results.push(entry);
			}
		}

		return results;
	}

	async getEditLog(year: number, month: number, day: number): Promise<string> {
		const path = this.paths.editLog(year, month, day);
		const entry = await this.read(path);
		return entry?.content || "No edits logged for this day.";
	}

	// --- Private helpers ---

	private makeEditRecord(action: EditAction, path: string, reason: string): EditRecord {
		return {
			timestamp: new Date().toISOString(),
			action,
			path,
			reason,
		};
	}

	private async logEdit(record: EditRecord): Promise<void> {
		// Extract date from the path or use current date
		const now = new Date();
		const logPath = this.paths.editLog(now.getFullYear(), now.getMonth() + 1, now.getDate());
		const line = editLogLine(record.timestamp, record.action, record.path, record.reason);

		const existing = await this.read(logPath);
		const content = existing ? `${existing.content}${line}\n` : `${line}\n`;
		await this.bucket.put(logPath, content);
	}
}
