export interface DigestPreferences {
	readonly enabled: boolean;
	readonly time: string;
	readonly includeWeekAhead: boolean;
	readonly includeOverdue: boolean;
	readonly includeEditLog: boolean;
}

export const DEFAULT_DIGEST_PREFERENCES: DigestPreferences = {
	enabled: true,
	time: "06:00",
	includeWeekAhead: true,
	includeOverdue: true,
	includeEditLog: true,
};
