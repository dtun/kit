import { runMorningRoutine } from "@application/use-cases/run-morning-routine";
import type { FamilyMember } from "@domain/entities/family-member";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService, MockMessageGateway } from "../helpers/mocks";

describe("runMorningRoutine", () => {
	let paths = createJournalPaths("journal/");
	let members: FamilyMember[] = [{ name: "Danny", contact: "danny@test.com", channel: "email" }];

	it("creates daily log, migrates tasks, and sends digests", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };

		// Seed yesterday with an open task
		let yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		let yY = yesterday.getFullYear();
		let yM = yesterday.getMonth() + 1;
		let yD = yesterday.getDate();
		await journal.write(
			paths.dailyLog(yY, yM, yD),
			"- [ ] Unfinished task from yesterday\n",
			"test seed",
		);

		ai.nextResponse = "Good morning. Here's your day. - Kit";

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
		});

		expect(result.dailyLogCreated).toBe(true);
		expect(result.tasksMigrated).toBe(1);
		expect(result.digestsSent.length).toBeGreaterThan(0);
		expect(result.errors.length).toBe(0);

		// Verify digest was sent
		expect(gateways.email.sentMessages.length).toBeGreaterThan(0);
	});

	it("survives individual step failures without crashing", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };

		// Make AI throw on complete (simulating Workers AI failure)
		ai.complete = async () => {
			throw new Error("AI unavailable");
		};

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
		});

		// Should still return a result, possibly with errors
		expect(result).toBeDefined();
		expect(result.dailyLogCreated).toBe(true);
	});

	it("records an error and still delivers when sendDigest falls back", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };

		ai.throwOnComplete = new Error("AI unavailable");

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
		});

		expect(result.digestsSent).toContain("Danny");
		expect(result.errors.some((e) => /fallback/i.test(e))).toBe(true);
		expect(gateways.email.sentMessages.length).toBe(1);
	});

	it("reports zero migrations when yesterday has no tasks", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };

		ai.nextResponse = "Nothing to report. - Kit";

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
		});

		expect(result.tasksMigrated).toBe(0);
	});
});
