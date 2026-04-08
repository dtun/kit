import { runMorningRoutine } from "@application/use-cases/run-morning-routine";
import type { FamilyMember } from "@domain/entities/family-member";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService, MockMessageGateway } from "../helpers/mocks";

describe("runMorningRoutine", () => {
	const paths = createJournalPaths("journal/");
	const members: FamilyMember[] = [{ name: "Danny", contact: "danny@test.com", channel: "email" }];

	it("creates daily log, migrates tasks, and sends digests", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

		// Seed yesterday with an open task
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yY = yesterday.getFullYear();
		const yM = yesterday.getMonth() + 1;
		const yD = yesterday.getDate();
		await journal.write(
			paths.dailyLog(yY, yM, yD),
			"- [ ] Unfinished task from yesterday\n",
			"test seed",
		);

		ai.nextResponse = "Good morning. Here's your day. — Kit";

		const result = await runMorningRoutine({
			journal,
			ai,
			messenger,
			paths,
			familyMembers: members,
		});

		expect(result.dailyLogCreated).toBe(true);
		expect(result.tasksMigrated).toBe(1);
		expect(result.digestsSent.length).toBeGreaterThan(0);
		expect(result.errors.length).toBe(0);

		// Verify digest was sent
		expect(messenger.sentMessages.length).toBeGreaterThan(0);
	});

	it("survives individual step failures without crashing", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

		// Make AI throw on complete (simulating Workers AI failure)
		ai.complete = async () => {
			throw new Error("AI unavailable");
		};

		const result = await runMorningRoutine({
			journal,
			ai,
			messenger,
			paths,
			familyMembers: members,
		});

		// Should still return a result, possibly with errors
		expect(result).toBeDefined();
		expect(result.dailyLogCreated).toBe(true);
	});

	it("reports zero migrations when yesterday has no tasks", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

		ai.nextResponse = "Nothing to report. — Kit";

		const result = await runMorningRoutine({
			journal,
			ai,
			messenger,
			paths,
			familyMembers: members,
		});

		expect(result.tasksMigrated).toBe(0);
	});
});
