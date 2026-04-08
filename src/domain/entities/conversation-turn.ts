export interface ConversationTurn {
	readonly role: "user" | "kit";
	readonly content: string;
	readonly timestamp: string;
	readonly memberName: string;
	readonly intent?: string;
}
