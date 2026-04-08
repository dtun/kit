import { parseInboundEmail } from "@adapters/email/email-parser";
import { describe, expect, it } from "vitest";

describe("parseInboundEmail", () => {
	it("parses a simple plain-text email from ArrayBuffer", async () => {
		const raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Remember this",
				"Content-Type: text/plain",
				"",
				"Remember that trash day is Thursday",
			].join("\r\n"),
		);

		const message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.from).toBe("danny@example.com");
		expect(message.channel).toBe("email");
		expect(message.subject).toBe("Remember this");
		expect(message.body).toContain("trash day is Thursday");
	});

	it("strips quoted replies", async () => {
		const raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Re: Question",
				"Content-Type: text/plain",
				"",
				"What about Friday?",
				"",
				"On Mon, Apr 7, 2026 Kit wrote:",
				"> Here is your weekly update.",
			].join("\r\n"),
		);

		const message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.body).toBe("What about Friday?");
		expect(message.body).not.toContain("weekly update");
	});

	it("normalizes sender email to lowercase", async () => {
		const raw = new TextEncoder().encode(
			["From: DANNY@EXAMPLE.COM", "Subject: Hi", "", "Hello"].join("\r\n"),
		);

		const message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"DANNY@EXAMPLE.COM",
			"kit@kitkit.dev",
		);

		expect(message.from).toBe("danny@example.com");
	});
});
