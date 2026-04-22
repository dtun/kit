export type IntentType =
	| "remember"
	| "recall"
	| "task"
	| "question"
	| "status"
	| "list_view"
	| "list_add"
	| "list_clear"
	| "edit_history"
	| "calendar_view"
	| "calendar_add"
	| "greeting"
	| "unknown";

export interface MessageClassification {
	readonly intent: IntentType;
	readonly confidence: number;
	readonly extractedData: {
		readonly content?: string;
		readonly category?: string;
		readonly person?: string;
		readonly date?: string;
		readonly tags: string[];
	};
}
