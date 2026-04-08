import { compileStatus } from "@application/use-cases/compile-status";
import { createDateContext } from "@domain/entities/date-context";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService } from "../helpers/mocks";

describe("compileStatus", () => {
	it("reads today's log and calls AI for summary", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const paths = createJournalPaths("journal/");

		const todayPath = paths.dailyLog(2026, 4, 7);
		await journal.write(todayPath, "- [ ] Call plumber\n- [o] Soccer at 10am", "test");

		ai.nextResponse = "You've got one task and soccer today. \u2014 Kit";
		const dateCtx = createDateContext(new Date(2026, 3, 7)); // Tuesday
		const reply = await compileStatus({ journal, ai, paths }, dateCtx, "Danny");

		expect(reply).toContain("Kit");
		expect(ai.lastSystemPrompt).toContain("Call plumber");
		expect(ai.lastSystemPrompt).toContain("Tuesday");
	});

	it("includes week-ahead framing on Sundays", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const paths = createJournalPaths("journal/");

		ai.nextResponse = "Here's your week ahead. \u2014 Kit";
		const sunday = new Date(2026, 3, 5);
		const dateCtx = createDateContext(sunday);
		await compileStatus({ journal, ai, paths }, dateCtx, "Danny");

		expect(ai.lastSystemPrompt).toContain("SUNDAY");
		expect(ai.lastSystemPrompt).toContain("week-ahead");
	});

	it("handles empty journal gracefully", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const paths = createJournalPaths("journal/");

		ai.nextResponse = "Nothing logged yet. \u2014 Kit";
		const dateCtx = createDateContext(new Date(2026, 3, 7));
		await compileStatus({ journal, ai, paths }, dateCtx, "Danny");

		expect(ai.lastSystemPrompt).toContain("empty");
	});
});
