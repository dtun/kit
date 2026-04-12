import { buildBulletDigest } from "@application/use-cases/build-bullet-digest";
import { createDateContext } from "@domain/entities/date-context";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

describe("buildBulletDigest", () => {
	let paths = createJournalPaths("journal/");

	it("returns empty string when journal is empty", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 7)); // Tue Apr 7

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest).toBe("");
	});

	it("includes today's log content", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 7)); // Tue Apr 7
		let today = "# Tuesday, April 7, 2026\n\n## tasks\n- [ ] Call plumber\n- [o] Soccer 4pm";
		await journal.write(paths.dailyLog(2026, 4, 7), today, "seed");

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest).toContain("journal");
		expect(digest).toContain("## today");
		expect(digest).toContain("- [ ] Call plumber");
		expect(digest).toContain("- [o] Soccer 4pm");
	});

	it("includes rest-of-week look-ahead on weekdays", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 8)); // Wed Apr 8
		await journal.write(paths.dailyLog(2026, 4, 8), "- [ ] Pay rent #bills", "seed");
		await journal.write(paths.dailyLog(2026, 4, 9), "- [o] Dentist 3pm", "seed");
		await journal.write(paths.dailyLog(2026, 4, 10), "- [ ] Mow lawn", "seed");

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest).toContain("## today");
		expect(digest).toContain("- [ ] Pay rent #bills");
		expect(digest.toLowerCase()).toContain("## thursday");
		expect(digest).toContain("- [o] Dentist 3pm");
		expect(digest.toLowerCase()).toContain("## friday");
		expect(digest).toContain("- [ ] Mow lawn");
	});

	it("includes monthly and future log sections on Sunday", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 5)); // Sun Apr 5
		await journal.write(paths.dailyLog(2026, 4, 5), "- [ ] Sunday plan", "seed");
		await journal.write(paths.monthlyLog(2026, 4), "## goals\n- [ ] Ship kit digest", "seed");
		await journal.write(paths.futureLog(), "## may\n- [ ] Taxes due", "seed");

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest.toLowerCase()).toContain("## this month");
		expect(digest).toContain("- [ ] Ship kit digest");
		expect(digest.toLowerCase()).toContain("## future log");
		expect(digest).toContain("- [ ] Taxes due");
	});

	it("omits monthly and future log sections on weekdays", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 8)); // Wed Apr 8
		await journal.write(paths.dailyLog(2026, 4, 8), "- [ ] today", "seed");
		await journal.write(paths.monthlyLog(2026, 4), "- [ ] Ship kit digest", "seed");
		await journal.write(paths.futureLog(), "- [ ] Taxes due", "seed");

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest.toLowerCase()).not.toContain("## this month");
		expect(digest.toLowerCase()).not.toContain("## future log");
		expect(digest).not.toContain("Ship kit digest");
		expect(digest).not.toContain("Taxes due");
	});

	it("collects overdue open tasks from prior 7 days", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 8)); // Wed Apr 8
		await journal.write(paths.dailyLog(2026, 4, 8), "- [ ] today task", "seed");
		await journal.write(
			paths.dailyLog(2026, 4, 6),
			"- [ ] Call plumber\n- [x] Buy milk\n- [>] Fix fence",
			"seed",
		);
		await journal.write(paths.dailyLog(2026, 4, 7), "- [ ] Pay rent", "seed");

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest.toLowerCase()).toContain("## overdue");
		expect(digest).toContain("- [ ] Call plumber");
		expect(digest).toContain("- [ ] Pay rent");
		expect(digest).not.toContain("Buy milk");
		expect(digest).not.toContain("Fix fence");
	});

	it("omits overdue section when no open tasks exist in prior days", async () => {
		let journal = new InMemoryJournalRepository();
		let dateCtx = createDateContext(new Date(2026, 3, 8)); // Wed Apr 8
		await journal.write(paths.dailyLog(2026, 4, 8), "- [ ] today", "seed");
		await journal.write(paths.dailyLog(2026, 4, 7), "- [x] done", "seed");

		let digest = await buildBulletDigest({ journal, paths }, dateCtx);

		expect(digest.toLowerCase()).not.toContain("## overdue");
	});
});
