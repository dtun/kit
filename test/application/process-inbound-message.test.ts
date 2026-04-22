import { processInboundMessage } from "@application/use-cases/process-inbound-message";
import { createJournalPaths } from "@domain/entities/journal-path";
import type { KitMessage } from "@domain/entities/kit-message";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	InMemoryJournalRepository,
	MockAIService,
	MockCalendarService,
	MockMessageGateway,
} from "../helpers/mocks";

let family = [
	{ name: "Danny", contact: "danny@example.com", channel: "email" as const },
	{ name: "Wife", contact: "wife@example.com", channel: "email" as const },
	{ name: "Son", contact: "+14805551234", channel: "sms" as const },
];

let kitConfig = { name: "Kit", email: "kit@kitkit.dev" };

function makeDeps() {
	return {
		journal: new InMemoryJournalRepository(),
		ai: new MockAIService(),
		messenger: new MockMessageGateway(),
		paths: createJournalPaths("journal/"),
		familyMembers: family,
		kitConfig,
	};
}

function makeMessage(body: string): KitMessage {
	return {
		from: "danny@example.com",
		channel: "email",
		subject: "Test",
		body,
		timestamp: new Date().toISOString(),
	};
}

describe("processInboundMessage", () => {
	it("processes a 'remember' intent and stores in journal", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "remember",
			confidence: 0.95,
			extractedData: { content: "Trash day is Thursday", tags: [] },
		};

		let result = await processInboundMessage(
			deps,
			makeMessage("Remember that trash day is Thursday"),
		);

		expect(result.intent.intent).toBe("remember");
		expect(result.journalUpdates.length).toBeGreaterThan(0);
		expect(deps.messenger.sentMessages.length).toBe(1);
		expect(deps.messenger.sentMessages[0].to).toBe("danny@example.com");
	});

	it("processes a 'task' intent and adds task to daily log", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "task",
			confidence: 0.9,
			extractedData: { content: "Call the plumber", tags: [] },
		};

		let result = await processInboundMessage(deps, makeMessage("Add call the plumber to my list"));

		expect(result.intent.intent).toBe("task");

		let today = new Date();
		let path = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		let entry = await deps.journal.read(path);
		expect(entry?.content).toContain("[ ] Call the plumber");
	});

	it("rejects unauthorized senders", async () => {
		let deps = makeDeps();
		let message = { ...makeMessage("Hi"), from: "stranger@evil.com" };

		await expect(processInboundMessage(deps, message)).rejects.toThrow("Unauthorized");
	});

	it("sends a reply for every processed message", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		await processInboundMessage(deps, makeMessage("Hey Kit!"));

		expect(deps.messenger.sentMessages.length).toBe(1);
	});

	it("logs the interaction in today's daily log", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		await processInboundMessage(deps, makeMessage("Hey Kit!"));

		let today = new Date();
		let path = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		let entry = await deps.journal.read(path);
		expect(entry?.content).toContain("Email from Danny");
	});

	it("sets reply subject with Re: prefix when original has subject", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		let result = await processInboundMessage(deps, makeMessage("Hello!"));

		expect(result.reply.subject).toBe("Re: Test");
		expect(result.reply.channel).toBe("email");
	});

	it("recall intent searches journal and returns relevant content", async () => {
		let deps = makeDeps();

		// Seed the journal with searchable content
		await deps.journal.write("journal/2026/04/05/daily.txt", "- Plumber Bob: 555-1234", "test");

		deps.ai.nextClassification = {
			intent: "recall",
			confidence: 0.9,
			extractedData: { content: "plumber", tags: [] },
		};
		deps.ai.nextResponse = "The plumber is Bob at 555-1234. \u2014 Kit";

		let result = await processInboundMessage(deps, makeMessage("What's the plumber's number?"));

		expect(result.reply.body).toContain("555-1234");
	});

	it("status intent produces a compiled digest", async () => {
		let deps = makeDeps();

		// Seed today's log
		let today = new Date();
		let todayPath = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		await deps.journal.write(todayPath, "- [ ] Call plumber\n- [o] Soccer at 10am", "test");

		deps.ai.nextClassification = {
			intent: "status",
			confidence: 0.9,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "You have one task and soccer today. \u2014 Kit";

		let result = await processInboundMessage(deps, makeMessage("What's going on today?"));

		expect(result.reply.body).toContain("Kit");
	});

	it("question intent returns an AI-generated answer", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "question",
			confidence: 0.85,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "I'd suggest flowers or a nice dinner out. \u2014 Kit";

		let result = await processInboundMessage(deps, makeMessage("What's a good gift for mom?"));

		expect(result.reply.body).toContain("Kit");
	});

	it("edit_history intent returns today's edit log", async () => {
		let deps = makeDeps();

		// Seed some edits so getEditLog returns something
		let today = new Date();
		let todayPath = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		await deps.journal.write(todayPath, "- Task added", "seed");

		deps.ai.nextClassification = {
			intent: "edit_history",
			confidence: 0.9,
			extractedData: { tags: [] },
		};

		let result = await processInboundMessage(deps, makeMessage("What changes did you make today?"));

		expect(result.reply.body).toContain("- Kit");
	});

	it("reply timestamp uses the same date as journal operations even across midnight", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-08T23:59:59.999Z"));

		let deps = makeDeps();
		// Advance time past midnight during classifyIntent (between line 50's `now` and line 80's timestamp)
		let originalClassify = deps.ai.classifyIntent.bind(deps.ai);
		deps.ai.classifyIntent = async (...args: Parameters<typeof deps.ai.classifyIntent>) => {
			vi.advanceTimersByTime(2); // now 2026-04-09T00:00:00.001Z
			return originalClassify(...args);
		};
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		let result = await processInboundMessage(deps, makeMessage("Hey Kit!"));

		// Reply timestamp must be on the same day as the captured `now` (April 8th)
		expect(result.reply.timestamp).toMatch(/^2026-04-08/);

		vi.useRealTimers();
	});

	it("logs 'SMS from' in daily log when message channel is sms", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		let smsMessage: KitMessage = {
			from: "+14805551234",
			channel: "sms",
			body: "Hey Kit!",
			timestamp: new Date().toISOString(),
		};

		await processInboundMessage(deps, smsMessage);

		let today = new Date();
		let path = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		let entry = await deps.journal.read(path);
		expect(entry?.content).toContain("SMS from Son");
		expect(entry?.content).not.toContain("Email from");
	});

	it("includes channel tone in system prompt for SMS messages", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		let smsMessage: KitMessage = {
			from: "+14805551234",
			channel: "sms",
			body: "Hey Kit!",
			timestamp: new Date().toISOString(),
		};

		await processInboundMessage(deps, smsMessage);

		expect(deps.ai.lastSystemPrompt).toContain("1-2 sentences");
		expect(deps.ai.lastSystemPrompt).toContain("brief");
	});

	it("directReply intents skip the second AI call", async () => {
		let deps = makeDeps();
		let completeCallCount = 0;
		let originalComplete = deps.ai.complete.bind(deps.ai);
		deps.ai.complete = async (systemPrompt: string, userMessage: string) => {
			completeCallCount++;
			return originalComplete(systemPrompt, userMessage);
		};

		deps.ai.nextClassification = {
			intent: "recall",
			confidence: 0.9,
			extractedData: { content: "nonexistent", tags: [] },
		};

		await processInboundMessage(deps, makeMessage("What's the plumber's number?"));

		// recall with no results returns a canned message — no AI complete call needed
		expect(completeCallCount).toBe(0);
	});

	it("injects cold start rules into greeting reply when journal is empty", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.9,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "stub";

		await processInboundMessage(deps, makeMessage("Hey Kit!"));

		expect(deps.ai.lastSystemPrompt).toContain("COLD START");
	});

	it("injects cold start rules into status reply when journal is empty", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "status",
			confidence: 0.9,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "stub";

		await processInboundMessage(deps, makeMessage("Hey Kit what's up, what's today like?"));

		expect(deps.ai.lastSystemPrompt).toContain("COLD START");
	});

	it("does NOT inject cold start rules when journal has 3+ daily logs", async () => {
		let deps = makeDeps();
		await deps.journal.write("journal/2026/04/01/daily.txt", "- entry one", "seed");
		await deps.journal.write("journal/2026/04/02/daily.txt", "- entry two", "seed");
		await deps.journal.write("journal/2026/04/03/daily.txt", "- entry three", "seed");

		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.9,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "stub";

		await processInboundMessage(deps, makeMessage("Hey Kit!"));

		expect(deps.ai.lastSystemPrompt).not.toContain("COLD START");
	});

	it("never produces confused 'I'm not sure' or 'tell me more' phrases on cold start", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "status",
			confidence: 0.8,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse =
			"Hey Danny. I'm just getting started \u2014 here's what I captured. \u2014 Kit";

		let result = await processInboundMessage(
			deps,
			makeMessage("Hey Kit what's up, what's today like?"),
		);

		expect(result.reply.body).not.toContain("I'm not sure what you're looking for");
		expect(result.reply.body).not.toContain("Can you tell me a bit more");
	});

	it("calendar_view returns formatted events when calendar is configured", async () => {
		let deps = makeDeps();
		let calendar = new MockCalendarService();
		calendar.events = [
			{
				uid: "evt-1",
				summary: "Soccer Practice",
				startDate: "2026-04-09T16:00:00Z",
				endDate: "2026-04-09T17:00:00Z",
				allDay: false,
				recurring: false,
				calendarName: "Family",
			},
		];
		(deps as any).calendar = calendar;
		deps.ai.nextClassification = {
			intent: "calendar_view",
			confidence: 0.95,
			extractedData: { tags: [] },
		};

		let result = await processInboundMessage(
			deps,
			makeMessage("What's on the calendar this week?"),
		);

		expect(result.reply.body).toContain("Soccer Practice");
		expect(result.reply.body).toContain("- Kit");
	});

	it("calendar_view returns nothing-on-calendar when no events", async () => {
		let deps = makeDeps();
		(deps as any).calendar = new MockCalendarService();
		deps.ai.nextClassification = {
			intent: "calendar_view",
			confidence: 0.9,
			extractedData: { tags: [] },
		};

		let result = await processInboundMessage(
			deps,
			makeMessage("Any events this week?"),
		);

		expect(result.reply.body).toContain("Nothing on the calendar");
		expect(result.reply.body).toContain("- Kit");
	});

	it("calendar_add creates event and confirms in reply", async () => {
		let deps = makeDeps();
		let calendar = new MockCalendarService();
		(deps as any).calendar = calendar;
		deps.ai.nextClassification = {
			intent: "calendar_add",
			confidence: 0.9,
			extractedData: {
				content: "Soccer Practice",
				date: "2026-04-15T16:00:00Z",
				tags: [],
			},
		};

		let result = await processInboundMessage(
			deps,
			makeMessage("Add soccer practice Wednesday at 4pm"),
		);

		expect(calendar.createdEvents).toHaveLength(1);
		expect(calendar.createdEvents[0].summary).toBe("Soccer Practice");
		expect(result.reply.body).toContain("Added to the calendar");
		expect(result.reply.body).toContain("Soccer Practice");
		expect(result.reply.body).toContain("- Kit");
	});

	it("calendar_view returns not-configured message when calendar dep is missing", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "calendar_view",
			confidence: 0.9,
			extractedData: { tags: [] },
		};

		let result = await processInboundMessage(
			deps,
			makeMessage("What's on the calendar?"),
		);

		expect(result.reply.body).toContain("Calendar isn't set up yet");
	});
});
