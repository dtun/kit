import type { IAIService } from "@application/ports/ai-service";
import type { IConversationStore } from "@application/ports/conversation-store";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
import type { ConversationTurn } from "@domain/entities/conversation-turn";
import type { EditRecord } from "@domain/entities/edit-record";
import type { MessageClassification } from "@domain/entities/intent";
import type { JournalEntry } from "@domain/entities/journal-entry";
import type { KitResponse } from "@domain/entities/kit-message";
import { vi } from "vitest";

export function createMockJournalRepository(): IJournalRepository {
	return {
		read: vi.fn().mockResolvedValue(null),
		write: vi.fn().mockResolvedValue({
			timestamp: new Date().toISOString(),
			action: "create" as const,
			path: "",
			reason: "",
		}),
		append: vi.fn().mockResolvedValue({
			timestamp: new Date().toISOString(),
			action: "update" as const,
			path: "",
			reason: "",
		}),
		list: vi.fn().mockResolvedValue([]),
		exists: vi.fn().mockResolvedValue(false),
		delete: vi.fn().mockResolvedValue({
			timestamp: new Date().toISOString(),
			action: "delete" as const,
			path: "",
			reason: "",
		}),
		search: vi.fn().mockResolvedValue([]),
		getEditLog: vi.fn().mockResolvedValue(""),
	};
}

export function createMockMessageGateway(): IMessageGateway {
	return {
		send: vi.fn().mockResolvedValue(undefined),
	};
}

export function createMockAIService(): IAIService {
	return {
		complete: vi.fn().mockResolvedValue("mock response"),
		classifyIntent: vi.fn().mockResolvedValue({
			intent: "greeting",
			confidence: 0.9,
			extractedData: { tags: [] },
		}),
	};
}

export class MockAIService implements IAIService {
	public lastSystemPrompt = "";
	public lastUserMessage = "";
	public nextResponse = "Got it. — Kit";
	public nextClassification: MessageClassification = {
		intent: "remember",
		confidence: 0.9,
		extractedData: { tags: [] },
	};

	async complete(systemPrompt: string, userMessage: string): Promise<string> {
		this.lastSystemPrompt = systemPrompt;
		this.lastUserMessage = userMessage;
		return this.nextResponse;
	}

	async classifyIntent(): Promise<MessageClassification> {
		return this.nextClassification;
	}
}

export class MockMessageGateway implements IMessageGateway {
	public sentMessages: KitResponse[] = [];

	async send(response: KitResponse): Promise<void> {
		this.sentMessages.push(response);
	}
}

export class InMemoryJournalRepository implements IJournalRepository {
	private store = new Map<string, string>();
	public editLog: EditRecord[] = [];

	async read(path: string): Promise<JournalEntry | null> {
		const content = this.store.get(path);
		if (!content) return null;
		return { path, content, lastModified: new Date().toISOString() };
	}

	async write(path: string, content: string, reason: string): Promise<EditRecord> {
		this.store.set(path, content);
		const record: EditRecord = {
			timestamp: new Date().toISOString(),
			action: "create",
			path,
			reason,
		};
		this.editLog.push(record);
		return record;
	}

	async append(path: string, content: string, reason: string): Promise<EditRecord> {
		const existing = this.store.get(path) || "";
		this.store.set(path, existing + content);
		const record: EditRecord = {
			timestamp: new Date().toISOString(),
			action: "update",
			path,
			reason,
		};
		this.editLog.push(record);
		return record;
	}

	async delete(path: string, reason: string): Promise<EditRecord> {
		this.store.delete(path);
		const record: EditRecord = {
			timestamp: new Date().toISOString(),
			action: "delete",
			path,
			reason,
		};
		this.editLog.push(record);
		return record;
	}

	async list(prefix: string): Promise<string[]> {
		return [...this.store.keys()].filter((k) => k.startsWith(prefix));
	}

	async exists(path: string): Promise<boolean> {
		return this.store.has(path);
	}

	async search(query: string): Promise<JournalEntry[]> {
		const results: JournalEntry[] = [];
		const lower = query.toLowerCase();
		for (const [path, content] of this.store) {
			if (content.toLowerCase().includes(lower)) {
				results.push({ path, content, lastModified: new Date().toISOString() });
			}
		}
		return results;
	}

	async getEditLog(): Promise<string> {
		return this.editLog.map((r) => `${r.action} ${r.path}`).join("\n");
	}
}

export function createMockConversationStore(): IConversationStore {
	return {
		addTurn: vi.fn().mockResolvedValue(undefined),
		getRecentTurns: vi.fn().mockResolvedValue([]),
		clear: vi.fn().mockResolvedValue(undefined),
	};
}

export class InMemoryConversationStore implements IConversationStore {
	private store = new Map<string, ConversationTurn[]>();

	async addTurn(memberContact: string, turn: ConversationTurn): Promise<void> {
		const turns = this.store.get(memberContact) || [];
		turns.push(turn);
		this.store.set(memberContact, turns);
	}

	async getRecentTurns(memberContact: string, limit = 10): Promise<ConversationTurn[]> {
		const turns = this.store.get(memberContact) || [];
		return turns.slice(-limit);
	}

	async clear(memberContact: string): Promise<void> {
		this.store.delete(memberContact);
	}
}
