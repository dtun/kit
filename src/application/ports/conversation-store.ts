import type { ConversationTurn } from "@domain/entities/conversation-turn";

export interface IConversationStore {
	addTurn(memberContact: string, turn: ConversationTurn): Promise<void>;
	getRecentTurns(memberContact: string, limit?: number): Promise<ConversationTurn[]>;
	clear(memberContact: string): Promise<void>;
}
