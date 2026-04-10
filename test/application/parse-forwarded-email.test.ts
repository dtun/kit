import { parseForwardedEmail } from "@application/use-cases/parse-forwarded-email";
import { describe, expect, it } from "vitest";

describe("parseForwardedEmail", () => {
	it("parses Apple Mail 'Begin forwarded message:' format", () => {
		let body = [
			"Note this date for me!",
			"",
			"Sent from my iPhone",
			"",
			"Begin forwarded message:",
			"",
			"From: Jimi Clayton <info@graciemesa.com>",
			"Date: April 9, 2026 at 11:29:40 AM MST",
			"To: Danny Tunney <dtun@me.com>",
			"Subject: Re: Combatives Belt Test - April 18th",
			"",
			"Perfect I have you down/ I also ordered your uniform as well.",
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(true);
		expect(result.userInstruction).toBe("Note this date for me!");
		expect(result.forwardedContent).not.toBeNull();
		expect(result.forwardedContent?.from).toContain("Jimi Clayton");
		expect(result.forwardedContent?.subject).toContain("Belt Test");
		expect(result.forwardedContent?.body).toContain("ordered your uniform");
	});

	it("parses Gmail '---------- Forwarded message ---------' format", () => {
		let body = [
			"FYI",
			"",
			"---------- Forwarded message ---------",
			"From: someone@example.com",
			"Date: April 9, 2026",
			"Subject: Meeting Thursday",
			"",
			"Let's meet at 3pm.",
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(true);
		expect(result.userInstruction).toBe("FYI");
		expect(result.forwardedContent?.subject).toContain("Meeting");
		expect(result.forwardedContent?.body).toContain("3pm");
	});

	it("parses Outlook '-------- Original Message --------' format", () => {
		let body = [
			"Please note",
			"",
			"-------- Original Message --------",
			"From: boss@work.com",
			"Subject: Deadline moved",
			"",
			"New deadline is April 25th.",
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(true);
		expect(result.userInstruction).toBe("Please note");
		expect(result.forwardedContent?.from).toContain("boss@work.com");
		expect(result.forwardedContent?.body).toContain("April 25th");
	});

	it("strips 'Sent from my iPhone' from user instruction", () => {
		let body = [
			"Remember this",
			"",
			"Sent from my iPhone",
			"",
			"Begin forwarded message:",
			"",
			"From: test@test.com",
			"Subject: Test",
			"",
			"Body content here.",
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.userInstruction).toBe("Remember this");
		expect(result.userInstruction).not.toContain("iPhone");
	});

	it("handles bare forward (no user instruction)", () => {
		let body = [
			"",
			"Sent from my iPhone",
			"",
			"Begin forwarded message:",
			"",
			"From: test@test.com",
			"Subject: Important info",
			"",
			"Here's the info.",
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(true);
		expect(result.userInstruction).toBe("forwarded without comment");
	});

	it("returns non-forwards as-is", () => {
		let body = "Remember that trash day is Thursday";
		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(false);
		expect(result.forwardedContent).toBeNull();
		expect(result.userInstruction).toBe(body);
	});

	it("detects forward via embedded From: + Subject: headers without explicit marker", () => {
		let body = [
			"From: someone@example.com",
			"Subject: A thing",
			"",
			"Body of the embedded forward.",
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(true);
		expect(result.forwardedContent?.from).toContain("someone@example.com");
		expect(result.forwardedContent?.subject).toContain("A thing");
	});

	it("preserves nested 'On X wrote:' content inside the forwarded body", () => {
		let body = [
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
		].join("\n");

		let result = parseForwardedEmail(body);

		expect(result.isForward).toBe(true);
		expect(result.forwardedContent?.body).toContain("Sounds good");
		expect(result.forwardedContent?.body).toContain("On Mon, Apr 1");
		expect(result.forwardedContent?.body).toContain("Original question text");
	});
});
