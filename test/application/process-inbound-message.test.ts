import { processInboundMessage } from "@application/use-cases/process-inbound-message";
import { createJournalPaths } from "@domain/entities/journal-path";
import type { KitMessage } from "@domain/entities/kit-message";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService, MockMessageGateway } from "../helpers/mocks";

const family = [
	{ name: "Danny", contact: "danny@example.com", channel: "email" as const },
	{ name: "Wife", contact: "wife@example.com", channel: "email" as const },
];

const kitConfig = { name: "Kit", email: "kit@kitkit.dev" };

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
		const deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "remember",
			confidence: 0.95,
			extractedData: { content: "Trash day is Thursday", tags: [] },
		};

		const result = await processInboundMessage(
			deps,
			makeMessage("Remember that trash day is Thursday"),
		);

		expect(result.intent.intent).toBe("remember");
		expect(result.journalUpdates.length).toBeGreaterThan(0);
		expect(deps.messenger.sentMessages.length).toBe(1);
		expect(deps.messenger.sentMessages[0].to).toBe("danny@example.com");
	});

	it("processes a 'task' intent and adds task to daily log", async () => {
		const deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "task",
			confidence: 0.9,
			extractedData: { content: "Call the plumber", tags: [] },
		};

		const result = await processInboundMessage(
			deps,
			makeMessage("Add call the plumber to my list"),
		);

		expect(result.intent.intent).toBe("task");

		const today = new Date();
		const path = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		const entry = await deps.journal.read(path);
		expect(entry?.content).toContain("[ ] Call the plumber");
	});

	it("rejects unauthorized senders", async () => {
		const deps = makeDeps();
		const message = { ...makeMessage("Hi"), from: "stranger@evil.com" };

		await expect(processInboundMessage(deps, message)).rejects.toThrow("Unauthorized");
	});

	it("sends a reply for every processed message", async () => {
		const deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		await processInboundMessage(deps, makeMessage("Hey Kit!"));

		expect(deps.messenger.sentMessages.length).toBe(1);
	});

	it("logs the interaction in today's daily log", async () => {
		const deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		await processInboundMessage(deps, makeMessage("Hey Kit!"));

		const today = new Date();
		const path = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		const entry = await deps.journal.read(path);
		expect(entry?.content).toContain("Email from Danny");
	});

	it("sets reply subject with Re: prefix when original has subject", async () => {
		const deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "greeting",
			confidence: 0.8,
			extractedData: { tags: [] },
		};

		const result = await processInboundMessage(deps, makeMessage("Hello!"));

		expect(result.reply.subject).toBe("Re: Test");
		expect(result.reply.channel).toBe("email");
	});

	it("recall intent searches journal and returns relevant content", async () => {
		const deps = makeDeps();

		// Seed the journal with searchable content
		await deps.journal.write("journal/2026/04/05/daily.txt", "- Plumber Bob: 555-1234", "test");

		deps.ai.nextClassification = {
			intent: "recall",
			confidence: 0.9,
			extractedData: { content: "plumber", tags: [] },
		};
		deps.ai.nextResponse = "The plumber is Bob at 555-1234. \u2014 Kit";

		const result = await processInboundMessage(deps, makeMessage("What's the plumber's number?"));

		expect(result.reply.body).toContain("555-1234");
	});

	it("status intent produces a compiled digest", async () => {
		const deps = makeDeps();

		// Seed today's log
		const today = new Date();
		const todayPath = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		await deps.journal.write(todayPath, "- [ ] Call plumber\n- [o] Soccer at 10am", "test");

		deps.ai.nextClassification = {
			intent: "status",
			confidence: 0.9,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "You have one task and soccer today. \u2014 Kit";

		const result = await processInboundMessage(deps, makeMessage("What's going on today?"));

		expect(result.reply.body).toContain("Kit");
	});

	it("question intent returns an AI-generated answer", async () => {
		const deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "question",
			confidence: 0.85,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse = "I'd suggest flowers or a nice dinner out. \u2014 Kit";

		const result = await processInboundMessage(deps, makeMessage("What's a good gift for mom?"));

		expect(result.reply.body).toContain("Kit");
	});

	it("edit_history intent returns today's edit log", async () => {
		const deps = makeDeps();

		// Seed some edits so getEditLog returns something
		const today = new Date();
		const todayPath = deps.paths.dailyLog(today.getFullYear(), today.getMonth() + 1, today.getDate());
		await deps.journal.write(todayPath, "- Task added", "seed");

		deps.ai.nextClassification = {
			intent: "edit_history",
			confidence: 0.9,
			extractedData: { tags: [] },
		};

		const result = await processInboundMessage(deps, makeMessage("What changes did you make today?"));

		expect(result.reply.body).toContain("\u2014 Kit");
	});

	it("directReply intents skip the second AI call", async () => {
		const deps = makeDeps();
		let completeCallCount = 0;
		const originalComplete = deps.ai.complete.bind(deps.ai);
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
});
