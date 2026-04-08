export interface MigrationItem {
	readonly originalPath: string;
	readonly destinationPath: string;
	readonly content: string;
	readonly reason: string;
}

export interface MigrationResult {
	readonly date: string;
	readonly migrated: MigrationItem[];
	readonly cancelled: string[];
	readonly kept: string[];
	readonly totalReviewed: number;
}
