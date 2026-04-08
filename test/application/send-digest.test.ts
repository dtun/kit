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
	const smsMember: FamilyMember = { name: "Ellen", contact: "+15551234567", channel: "sms" };

	it("sends digest email to email-channel members", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

		ai.nextResponse = "Good morning, Danny. Here's your day. — Kit";

		const result = await sendDigest(
			{ journal, ai, messenger, paths },
			[emailMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		expect(result.sentTo).toContain("Danny");
		expect(result.skipped.length).toBe(0);
		expect(messenger.sentMessages.length).toBe(1);
		expect(messenger.sentMessages[0].to).toBe("danny@test.com");
	});

	it("skips members with non-email channels", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

		const result = await sendDigest(
			{ journal, ai, messenger, paths },
			[smsMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
		);

		expect(result.sentTo.length).toBe(0);
		expect(result.skipped).toContain("Ellen");
		expect(messenger.sentMessages.length).toBe(0);
	});

	it("includes migration summary when provided", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

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
			{ journal, ai, messenger, paths },
			[emailMember],
			DEFAULT_DIGEST_PREFERENCES,
			dateCtx,
			migrationResult,
		);

		expect(messenger.sentMessages[0].body).toContain("Call plumber");
		expect(messenger.sentMessages[0].body).toContain("1 task");
	});

	it("returns empty sentTo when preferences.enabled is false", async () => {
		const journal = new InMemoryJournalRepository();
		const ai = new MockAIService();
		const messenger = new MockMessageGateway();

		const result = await sendDigest(
			{ journal, ai, messenger, paths },
			[emailMember],
			{ ...DEFAULT_DIGEST_PREFERENCES, enabled: false },
			dateCtx,
		);

		expect(result.sentTo.length).toBe(0);
		expect(result.skipped).toContain("Danny");
		expect(messenger.sentMessages.length).toBe(0);
	});
});
