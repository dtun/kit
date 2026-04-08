import { sendDigest } from "@application/use-cases/send-digest";
import { createDateContext } from "@domain/entities/date-context";
import { DEFAULT_DIGEST_PREFERENCES } from "@domain/entities/digest-preferences";
import type { FamilyMember } from "@domain/entities/family-member";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, MockAIService, MockMessageGateway } from "../helpers/mocks";

describe("sendDigest", () => {
	const paths = createJournalPaths("journal/");
	const dateCtx = createDateContext(new Date(2026, 3, 7));

	const emailMember: FamilyMember = { name: "Danny", contact: "danny@test.com", channel: "email" };
	const smsMember: FamilyMember = { name: "Son", contact: "+14805551234", channel: "sms" };

	function makeGateways() {
		return {
			email: new MockMessageGateway(),
			sms: new MockMessageGateway(),
		};
	}

	it("sends digest email to email-channel members", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const gateways = makeGateways();

		ai.nextResponse = "Good morning, Danny. Here's your day. — Kit";

		const result = await sendDigest(
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

	it("sends digest to SMS members via SMS gateway", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const gateways = makeGateways();

		ai.nextResponse = "Morning — 1 task today.";

		const result = await sendDigest(
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
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const gateways = makeGateways();

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
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const gateways = makeGateways();

		ai.nextResponse = "Here's your day.";

		const result = await sendDigest(
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
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const gateways = makeGateways();

		ai.nextResponse = "Here's your day.";

		const migrationResult = {
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
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const gateways = makeGateways();

		const result = await sendDigest(
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
