import { answerQuestion } from "@application/use-cases/answer-question";
import { createDateContext } from "@domain/entities/date-context";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService } from "../helpers/mocks";

describe("answerQuestion", () => {
	it("includes today's log and search results in AI prompt", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const paths = createJournalPaths("journal/");

		const todayPath = paths.dailyLog(2026, 4, 7);
		await journal.write(todayPath, "- [o] Soccer at 10am", "test");
		await journal.write("journal/2026/04/05/daily.txt", "- Dinner reservation at 7pm", "test");

		ai.nextResponse = "You have soccer at 10am today. \u2014 Kit";
		const dateCtx = createDateContext(new Date(2026, 3, 7));
		const reply = await answerQuestion(
			{ journal, ai, paths },
			"What's happening today?",
			"Danny",
			dateCtx,
		);

		expect(ai.lastSystemPrompt).toContain("Soccer at 10am");
		expect(reply).toContain("soccer");
	});

	it("calls AI even when journal has no relevant context", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const paths = createJournalPaths("journal/");

		ai.nextResponse = "I don't have anything in my journal about that. \u2014 Kit";
		const dateCtx = createDateContext(new Date(2026, 3, 7));
		const reply = await answerQuestion(
			{ journal, ai, paths },
			"What's a good gift for mom?",
			"Danny",
			dateCtx,
		);

		expect(reply).toBeTruthy();
		expect(ai.lastUserMessage).toBe("What's a good gift for mom?");
	});
});
