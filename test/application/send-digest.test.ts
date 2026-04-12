import { sendDigest } from "@application/use-cases/send-digest";
import { createDateContext } from "@domain/entities/date-context";
import { DEFAULT_DIGEST_PREFERENCES } from "@domain/entities/digest-preferences";
import type { FamilyMember } from "@domain/entities/family-member";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService, MockMessageGateway } from "../helpers/mocks";

describe("sendDigest", () => {
	let paths = createJournalPaths("journal/");
	let dateCtx = createDateContext(new Date(2026, 3, 7));

	let emailMember: FamilyMember = { name: "Danny", contact: "danny@test.com", channel: "email" };
	let smsMember: FamilyMember = { name: "Son", contact: "+14805551234", channel: "sms" };

	function makeGateways() {
		return {
			email: new MockMessageGateway(),
			sms: new MockMessageGateway(),
		};
	}

	it("sends digest email to email-channel members", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "Good morning, Danny. Here's your day. - Kit";

		let result = await sendDigest(
			{ journal, ai, gateways, paths },
			[emailMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		expect(result.sentTo).toContain("Danny");
		expect(result.skipped.length).toBe(0);
		expect(gateways.email.sentMessages.length).toBe(1);
		expect(gateways.email.sentMessages[0].to).toBe("danny@test.com");
	});

	it("appends bullet journal digest below AI prose for email members", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "AI PROSE";
		await journal.write(paths.dailyLog(2026, 4, 7), "- [ ] Call plumber\n- [o] Soccer 4pm", "seed");

		await sendDigest(
			{ journal, ai, gateways, paths },
			[emailMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		let body = gateways.email.sentMessages[0].body;
		expect(body).toContain("AI PROSE");
		expect(body).toContain("journal");
		expect(body).toContain("## today");
		expect(body).toContain("- [ ] Call plumber");
		expect(body.indexOf("AI PROSE")).toBeLessThan(body.indexOf("## today"));
	});

	it("does not append bullet journal digest to SMS messages", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "SMS PROSE";
		await journal.write(paths.dailyLog(2026, 4, 7), "- [ ] Call plumber", "seed");

		await sendDigest(
			{ journal, ai, gateways, paths },
			[smsMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		let body = gateways.sms.sentMessages[0].body;
		expect(body).toContain("SMS PROSE");
		expect(body).not.toContain("## today");
	});

	it("sends digest to SMS members via SMS gateway", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "Morning — 1 task today.";

		let result = await sendDigest(
			{ journal, ai, gateways, paths },
			[smsMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		expect(result.sentTo).toContain("Son");
		expect(result.skipped.length).toBe(0);
		expect(gateways.sms.sentMessages.length).toBe(1);
		expect(gateways.sms.sentMessages[0].to).toBe("+14805551234");
		expect(gateways.sms.sentMessages[0].channel).toBe("sms");
	});

	it("SMS digest has no subject", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "Morning — 1 task today.";

		await sendDigest(
			{ journal, ai, gateways, paths },
			[smsMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		expect(gateways.sms.sentMessages[0].subject).toBeUndefined();
	});

	it("handles mixed email and SMS members", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "Here's your day.";

		let result = await sendDigest(
			{ journal, ai, gateways, paths },
			[emailMember, smsMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		expect(result.sentTo).toContain("Danny");
		expect(result.sentTo).toContain("Son");
		expect(gateways.email.sentMessages.length).toBe(1);
		expect(gateways.sms.sentMessages.length).toBe(1);
	});

	it("includes migration summary when provided", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		ai.nextResponse = "Here's your day.";

		let migrationResult = {
			date: new Date().toISOString(),
			migrated: [
				{ originalPath: "a", destinationPath: "b", content: "Call plumber", reason: "migrated" },
			],
			cancelled: [],
			kept: [],
			totalReviewed: 1,
		};

		await sendDigest(
			{ journal, ai, gateways, paths },
			[emailMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
			migrationResult,
		);

		expect(gateways.email.sentMessages[0].body).toContain("Call plumber");
		expect(gateways.email.sentMessages[0].body).toContain("1 task");
	});

	it("returns empty sentTo when preferences.enabled is false", async () => {
		let journal = new InMemoryJournalRepository();
		let ai = new MockAIService();
		let gateways = makeGateways();

		let result = await sendDigest(
			{ journal, ai, gateways, paths },
			[emailMember],
			{ ...DEFAULT_DIGEST_PREFERENCES, enabled: false },
			dateCtx,
		);

		expect(result.sentTo.length).toBe(0);
		expect(result.skipped).toContain("Danny");
		expect(gateways.email.sentMessages.length).toBe(0);
	});
});
