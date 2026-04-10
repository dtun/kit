import { recallFromJournal } from "@application/use-cases/recall-from-journal";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService } from "../helpers/mocks";

describe("recallFromJournal", () => {
	it("returns a not-found message when journal has no matches", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();

		let reply = await recallFromJournal({ journal, ai }, "plumber", "Danny");

		expect(reply).toContain("didn't find anything");
		expect(reply).toContain("plumber");
	});

	it("passes search results to AI when found", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();

		await journal.write("journal/2026/04/05/daily.txt", "- Plumber Bob: 555-1234", "test");

		ai.nextResponse = "The plumber is Bob at 555-1234. \u2014 Kit";
		let reply = await recallFromJournal({ journal, ai }, "plumber", "Danny");

		expect(ai.lastSystemPrompt).toContain("555-1234");
		expect(reply).toContain("555-1234");
	});

	it("injects cold start rules into the system prompt when provided", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();

		await journal.write("journal/2026/04/05/daily.txt", "- Plumber Bob: 555-1234", "test");

		ai.nextResponse = "stub";
		await recallFromJournal(
			{ journal, ai, coldStartRules: ["rule-alpha", "rule-beta"] },
			"plumber",
			"Danny",
		);

		expect(ai.lastSystemPrompt).toContain("COLD START");
		expect(ai.lastSystemPrompt).toContain("rule-alpha");
		expect(ai.lastSystemPrompt).toContain("rule-beta");
	});

	it("omits cold start section when rules are not provided", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();

		await journal.write("journal/2026/04/05/daily.txt", "- Plumber Bob: 555-1234", "test");

		ai.nextResponse = "stub";
		await recallFromJournal({ journal, ai }, "plumber", "Danny");

		expect(ai.lastSystemPrompt).not.toContain("COLD START");
	});
});
