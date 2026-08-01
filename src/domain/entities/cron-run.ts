/**
 * The outcome of one scheduled (cron) run of the morning routine. Exactly one
 * of these is kept — the most recent — so an operator can answer "did the cron
 * actually run, and did it work?" without reading logs.
 */
export interface CronRun {
	/** ISO timestamp of when the run finished. */
	readonly at: string;
	readonly ok: boolean;
	/** Short failure summary. Present only on a failed run. */
	readonly reason?: string;
}

/**
 * The reason is surfaced on the public /health endpoint, so it is capped to a
 * length that stays readable and cannot turn a stack trace into a payload.
 */
export const CRON_RUN_REASON_MAX_LENGTH = 200;

export function createCronRun(input: { at: Date; ok: boolean; reason?: string }): CronRun {
	if (input.ok) {
		return { at: input.at.toISOString(), ok: true };
	}

	let reason = truncateReason(input.reason);
	return reason === undefined
		? { at: input.at.toISOString(), ok: false }
		: { at: input.at.toISOString(), ok: false, reason };
}

function truncateReason(reason: string | undefined): string | undefined {
	let trimmed = reason?.trim();
	if (!trimmed) return undefined;
	if (trimmed.length <= CRON_RUN_REASON_MAX_LENGTH) return trimmed;
	return `${trimmed.slice(0, CRON_RUN_REASON_MAX_LENGTH - 1)}…`;
}
