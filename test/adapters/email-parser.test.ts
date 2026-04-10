import { parseInboundEmail } from "@adapters/email/email-parser";
import { describe, expect, it } from "vitest";

describe("parseInboundEmail", () => {
	it("parses a simple plain-text email from ArrayBuffer", async () => {
		let raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Remember this",
				"Content-Type: text/plain",
				"",
				"Remember that trash day is Thursday",
			].join("\r\n"),
		);

		let message = await parseInboundEmail(
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
		let raw = new TextEncoder().encode(
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

		let message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.body).toBe("What about Friday?");
		expect(message.body).not.toContain("weekly update");
	});

	it("normalizes sender email to lowercase", async () => {
		let raw = new TextEncoder().encode(
			["From: DANNY@EXAMPLE.COM", "Subject: Hi", "", "Hello"].join("\r\n"),
		);

		let message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"DANNY@EXAMPLE.COM",
			"kit@kitkit.dev",
		);

		expect(message.from).toBe("danny@example.com");
	});

	it("preserves Gmail '---------- Forwarded message ---------' marker and body", async () => {
		let raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Fwd: Meeting",
				"Content-Type: text/plain",
				"",
				"FYI",
				"",
				"---------- Forwarded message ---------",
				"From: alice@example.com",
				"Subject: Meeting Thursday",
				"",
				"Let's meet at 3pm.",
			].join("\r\n"),
		);

		let message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.body).toContain("Forwarded message");
		expect(message.body).toContain("alice@example.com");
		expect(message.body).toContain("Let's meet at 3pm");
	});

	it("preserves Apple Mail 'Begin forwarded message:' marker and body", async () => {
		let raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Fwd: Belt test",
				"Content-Type: text/plain",
				"",
				"Note this date for me!",
				"",
				"Sent from my iPhone",
				"",
				"Begin forwarded message:",
				"",
				"From: Jimi Clayton <info@graciemesa.com>",
				"Subject: Re: Combatives Belt Test - April 18th",
				"",
				"Perfect I have you down.",
			].join("\r\n"),
		);

		let message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.body).toContain("Begin forwarded message:");
		expect(message.body).toContain("Jimi Clayton");
		expect(message.body).toContain("Perfect I have you down");
	});

	it("preserves Outlook '-------- Original Message --------' marker and body", async () => {
		let raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Fwd: Deadline",
				"Content-Type: text/plain",
				"",
				"Please note",
				"",
				"-------- Original Message --------",
				"From: boss@work.com",
				"Subject: Deadline moved",
				"",
				"New deadline is April 25th.",
			].join("\r\n"),
		);

		let message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.body).toContain("Original Message");
		expect(message.body).toContain("boss@work.com");
		expect(message.body).toContain("April 25th");
	});

	it("preserves forwarded body containing nested 'On X wrote:' reply chains", async () => {
		let raw = new TextEncoder().encode(
			[
				"From: danny@example.com",
				"To: kit@kitkit.dev",
				"Subject: Fwd: Project update",
				"Content-Type: text/plain",
				"",
				"FYI",
				"",
				"Begin forwarded message:",
				"",
				"From: alice@example.com",
				"Subject: Re: Project update",
				"",
				"Sounds good. See my reply below.",
				"",
				"On Mon, Apr 1, 2026, Bob wrote:",
				"> Original question text here",
			].join("\r\n"),
		);

		let message = await parseInboundEmail(
			raw.buffer as ArrayBuffer,
			"danny@example.com",
			"kit@kitkit.dev",
		);

		expect(message.body).toContain("Sounds good");
		expect(message.body).toContain("On Mon, Apr 1");
		expect(message.body).toContain("Original question text");
	});
});
