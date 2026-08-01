import type { ICronRunStore } from "@application/ports/cron-run-store";
import type { CronRun } from "@domain/entities/cron-run";

/**
 * Single-row store for the most recent cron outcome, backed by the KitAgent
 * Durable Object's SQLite. The `id = 1` check keeps the table to one row: every
 * run overwrites the previous one, so this never grows.
 */
export class SqliteCronRunStore implements ICronRunStore {
	private sql: SqlStorage;

	constructor(sql: SqlStorage) {
		this.sql = sql;
		this.initialize();
	}

	private initialize() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS cron_runs (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				at TEXT NOT NULL,
				ok INTEGER NOT NULL,
				reason TEXT
			)
		`);
	}

	async record(run: CronRun): Promise<void> {
		this.sql.exec(
			"INSERT OR REPLACE INTO cron_runs (id, at, ok, reason) VALUES (1, ?, ?, ?)",
			run.at,
			run.ok ? 1 : 0,
			run.reason ?? null,
		);
	}

	async getLast(): Promise<CronRun | null> {
		let rows = [...this.sql.exec("SELECT at, ok, reason FROM cron_runs WHERE id = 1")];
		let row = rows[0];
		if (!row) return null;

		let at = row.at as string;
		let ok = Number(row.ok) === 1;
		let reason = row.reason as string | null;
		return reason ? { at, ok, reason } : { at, ok };
	}
}
