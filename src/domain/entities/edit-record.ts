export type EditAction = "create" | "update" | "migrate" | "archive" | "delete";

export interface EditRecord {
	readonly timestamp: string;
	readonly action: EditAction;
	readonly path: string;
	readonly reason: string;
	readonly diff?: string;
}
