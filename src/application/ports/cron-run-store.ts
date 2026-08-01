import type { CronRun } from "@domain/entities/cron-run";

export interface ICronRunStore {
	/** Overwrites the stored outcome — only the most recent run is kept. */
	record(run: CronRun): Promise<void>;
	/** Null when the cron has never run on this deployment. */
	getLast(): Promise<CronRun | null>;
}
