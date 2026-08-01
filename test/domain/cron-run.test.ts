import { CRON_RUN_REASON_MAX_LENGTH, createCronRun } from "@domain/entities/cron-run";
import { describe, expect, it } from "vitest";

describe("CronRun", () => {
	it("records the run time as an ISO timestamp", () => {
		let run = createCronRun({ at: new Date("2026-08-01T14:00:00.000Z"), ok: true });
		expect(run.at).toBe("2026-08-01T14:00:00.000Z");
	});

	it("marks a clean run ok with no reason", () => {
		let run = createCronRun({ at: new Date(), ok: true });
		expect(run.ok).toBe(true);
		expect(run.reason).toBeUndefined();
	});

	it("keeps the failure reason on a failed run", () => {
		let run = createCronRun({ at: new Date(), ok: false, reason: "Digest: boom" });
		expect(run.ok).toBe(false);
		expect(run.reason).toBe("Digest: boom");
	});

	it("drops a reason on a successful run", () => {
		let run = createCronRun({ at: new Date(), ok: true, reason: "ignored" });
		expect(run.reason).toBeUndefined();
	});

	it("drops a blank reason", () => {
		let run = createCronRun({ at: new Date(), ok: false, reason: "   " });
		expect(run.reason).toBeUndefined();
	});

	it("truncates a long reason so the health payload stays small", () => {
		let long = "x".repeat(CRON_RUN_REASON_MAX_LENGTH + 500);
		let run = createCronRun({ at: new Date(), ok: false, reason: long });
		expect(run.reason).toBeDefined();
		expect(run.reason!.length).toBeLessThanOrEqual(CRON_RUN_REASON_MAX_LENGTH);
		expect(run.reason!.endsWith("…")).toBe(true);
	});
});
