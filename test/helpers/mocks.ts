import type { IAIService } from "@application/ports/ai-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { IMessageGateway } from "@application/ports/message-gateway";
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
		list: vi.fn().mockResolvedValue([]),
		delete: vi.fn().mockResolvedValue({
			timestamp: new Date().toISOString(),
			action: "delete" as const,
			path: "",
			reason: "",
		}),
		search: vi.fn().mockResolvedValue([]),
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
	};
}
