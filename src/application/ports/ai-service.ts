import type { MessageClassification } from "@domain/entities/intent";

export interface IAIService {
	complete(systemPrompt: string, userMessage: string): Promise<string>;
	classifyIntent(userMessage: string, context: string): Promise<MessageClassification>;
}
