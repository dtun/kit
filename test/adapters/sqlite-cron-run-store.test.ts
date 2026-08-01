import { SqliteCronRunStore } from "@adapters/persistence/sqlite-cron-run-store";
import { createCronRun } from "@domain/entities/cron-run";
import { describe, expect, it, vi } from "vitest";

/**
 * Minimal mock of Cloudflare's SqlStorage interface, modelling the single-row
 * cron_runs table: INSERT OR REPLACE overwrites, SELECT yields what is there.
 */
function createMockSqlStorage() {
	let row: Record<string, unknown> | null = null;

	return {
		exec: vi.fn().mockImplementation((...args: unknown[]) => {
			let sql = (args[0] as string).trim();
			if (sql.startsWith("INSERT")) {
				row = { at: args[1], ok: args[2], reason: args[3] };
				return { toArray: () => [] };
			}
			if (sql.startsWith("SELECT")) {
				let rows = row ? [row] : [];
				return {
					[Symbol.iterator]: function* () {
						for (let r of rows) yield r;
					},
				};
			}
			// CREATE TABLE — no-op
			return { toArray: () => [] };
		}),
	};
}

describe("SqliteCronRunStore", () => {
	it("creates the table on construction", () => {
		let sql = createMockSqlStorage();
		new SqliteCronRunStore(sql as unknown as SqlStorage);

		let calls = sql.exec.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
		expect(calls.some((c: string) => c.includes("CREATE TABLE IF NOT EXISTS cron_runs"))).toBe(
			true,
		);
	});

	it("returns null before the cron has ever run", async () => {
		let sql = createMockSqlStorage();
		let store = new SqliteCronRunStore(sql as unknown as SqlStorage);

		expect(await store.getLast()).toBeNull();
	});

	it("round-trips a successful run", async () => {
		let sql = createMockSqlStorage();
		let store = new SqliteCronRunStore(sql as unknown as SqlStorage);

		await store.record(createCronRun({ at: new Date("2026-08-01T14:00:00.000Z"), ok: true }));

		let last = await store.getLast();
		expect(last).toEqual({ at: "2026-08-01T14:00:00.000Z", ok: true });
	});

	it("round-trips a failed run with its reason", async () => {
		let sql = createMockSqlStorage();
		let store = new SqliteCronRunStore(sql as unknown as SqlStorage);

		await store.record(
			createCronRun({
				at: new Date("2026-08-01T14:00:00.000Z"),
				ok: false,
				reason: "Digest: boom",
			}),
		);

		let last = await store.getLast();
		expect(last).toEqual({ at: "2026-08-01T14:00:00.000Z", ok: false, reason: "Digest: boom" });
	});

	it("keeps only the most recent run", async () => {
		let sql = createMockSqlStorage();
		let store = new SqliteCronRunStore(sql as unknown as SqlStorage);

		await store.record(
			createCronRun({ at: new Date("2026-07-31T14:00:00.000Z"), ok: false, reason: "old" }),
		);
		await store.record(createCronRun({ at: new Date("2026-08-01T14:00:00.000Z"), ok: true }));

		let last = await store.getLast();
		expect(last).toEqual({ at: "2026-08-01T14:00:00.000Z", ok: true });
	});
});
