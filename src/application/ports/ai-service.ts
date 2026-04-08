export interface IAIService {
	complete(systemPrompt: string, userMessage: string): Promise<string>;
}
