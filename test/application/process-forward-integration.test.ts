import { processInboundMessage } from "@application/use-cases/process-inbound-message";
import { createJournalPaths } from "@domain/entities/journal-path";
import type { KitMessage } from "@domain/entities/kit-message";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService, MockMessageGateway } from "../helpers/mocks";

let family = [{ name: "Danny", contact: "danny@example.com", channel: "email" as const }];
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

let appleMailForwardBody = [
	"Note this date for me!",
	"",
	"Sent from my iPhone",
	"",
	"Begin forwarded message:",
	"",
	"From: Jimi Clayton <info@graciemesa.com>",
	"Date: April 9, 2026 at 11:29:40 AM MST",
	"Subject: Re: Combatives Belt Test - April 18th",
	"",
	"Perfect I have you down.",
].join("\n");

describe("processInboundMessage with forwarded emails", () => {
	it("extracts event from forwarded Apple Mail email and stores in journal", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "remember",
			confidence: 0.95,
			extractedData: {
				content: "Combatives Belt Test — April 18th",
				date: "2026-04-18",
				tags: ["bjj", "events"],
			},
		};
		deps.ai.nextResponse = "Got it. Belt test on April 18th. — Kit";

		let message: KitMessage = {
			from: "danny@example.com",
			channel: "email",
			subject: "Fwd: Combatives Belt Test - April 18th",
			body: appleMailForwardBody,
			timestamp: new Date().toISOString(),
		};

		let result = await processInboundMessage(deps, message);

		expect(result.intent.intent).toBe("remember");
		expect(result.journalUpdates.length).toBeGreaterThan(0);

		// Daily log should contain the forwarded subject
		let today = new Date();
		let dailyPath = deps.paths.dailyLog(
			today.getFullYear(),
			today.getMonth() + 1,
			today.getDate(),
		);
		let dailyEntry = await deps.journal.read(dailyPath);
		expect(dailyEntry?.content).toContain("Combatives Belt Test");

		// Future log should contain the dated event
		let futureLog = await deps.journal.read(deps.paths.futureLog());
		expect(futureLog?.content).toContain("2026-04-18");
	});

	it("passes structured forward content to the intent classifier", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "remember",
			confidence: 0.9,
			extractedData: { content: "Belt test", tags: [] },
		};
		deps.ai.nextResponse = "stub";

		let message: KitMessage = {
			from: "danny@example.com",
			channel: "email",
			subject: "Fwd: Belt Test",
			body: appleMailForwardBody,
			timestamp: new Date().toISOString(),
		};

		await processInboundMessage(deps, message);

		expect(deps.ai.lastClassificationBody).toContain("User instruction:");
		expect(deps.ai.lastClassificationBody).toContain("Note this date for me!");
		expect(deps.ai.lastClassificationBody).toContain("Forwarded email from:");
		expect(deps.ai.lastClassificationBody).toContain("Jimi Clayton");
	});

	it("never produces confused language on cold start 'what's up' message", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "status",
			confidence: 0.8,
			extractedData: { tags: [] },
		};
		deps.ai.nextResponse =
			"Hey Danny. I'm just getting started — here's what I captured. — Kit";

		let message: KitMessage = {
			from: "danny@example.com",
			channel: "email",
			subject: "What's up",
			body: "Hey Kit what's up, what's today like?",
			timestamp: new Date().toISOString(),
		};

		let result = await processInboundMessage(deps, message);

		expect(deps.ai.lastSystemPrompt).toContain("COLD START");
		expect(result.reply.body).not.toContain("I'm not sure what you're looking for");
		expect(result.reply.body).not.toContain("Can you tell me a bit more");
	});

	it("passes non-forward messages through unchanged", async () => {
		let deps = makeDeps();
		deps.ai.nextClassification = {
			intent: "remember",
			confidence: 0.95,
			extractedData: { content: "Trash day is Thursday", tags: [] },
		};
		deps.ai.nextResponse = "Got it. — Kit";

		let message: KitMessage = {
			from: "danny@example.com",
			channel: "email",
			subject: "Note",
			body: "Remember that trash day is Thursday",
			timestamp: new Date().toISOString(),
		};

		let result = await processInboundMessage(deps, message);

		expect(result.intent.intent).toBe("remember");
		// Classifier should have received the raw body, not a forward-wrapped version
		expect(deps.ai.lastClassificationBody).toBe("Remember that trash day is Thursday");
		expect(deps.ai.lastClassificationBody).not.toContain("User instruction:");
	});
});
