import { runMorningRoutine } from "@application/use-cases/run-morning-routine";
import type { FamilyMember } from "@domain/entities/family-member";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import {
	InMemoryJournalRepository,
	MockAIService,
	MockCalendarService,
	MockMessageGateway,
} from "../helpers/mocks";

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

	it("syncs calendar events into today's daily log when calendar is provided", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };
		let calendar = new MockCalendarService();
		calendar.events = [
			{
				uid: "evt-1",
				summary: "Soccer Practice",
				startDate: "2026-04-09T23:00:00Z",
				endDate: "2026-04-09T00:00:00Z",
				allDay: false,
				recurring: false,
				calendarName: "Family",
			},
		];
		ai.nextResponse = "Good morning. - Kit";

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
			calendar,
		});

		expect(result.errors.length).toBe(0);

		let today = new Date();
		let todayPath = paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		let log = await journal.read(todayPath);
		expect(log?.content).toContain("## Calendar");
		expect(log?.content).toContain("Soccer Practice");
	});

	it("accumulates calendar sync error but still completes routine", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };
		let calendar = new MockCalendarService();
		calendar.fetchEvents = async () => {
			throw new Error("CalDAV timeout");
		};
		ai.nextResponse = "Good morning. - Kit";

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
			calendar,
		});

		expect(result.errors.some((e) => e.includes("Calendar sync"))).toBe(true);
		expect(result.dailyLogCreated).toBe(true);
	});

	it("skips calendar sync when calendar dep is not provided", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = { email: new MockMessageGateway(), sms: new MockMessageGateway() };
		ai.nextResponse = "Good morning. - Kit";

		let result = await runMorningRoutine({
			journal,
			ai,
			gateways,
			paths,
			familyMembers: members,
		});

		expect(result.errors.length).toBe(0);

		let today = new Date();
		let todayPath = paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		let log = await journal.read(todayPath);
		expect(log?.content).not.toContain("## Calendar");
	});
});
