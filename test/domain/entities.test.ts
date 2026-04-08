import { JournalEntryNotFoundError, UnauthorizedSenderError } from "@domain/errors";
import { describe, expect, it } from "vitest";

describe("Domain errors", () => {
	it("creates UnauthorizedSenderError with sender info", () => {
		const err = new UnauthorizedSenderError("stranger@evil.com");
		expect(err.name).toBe("UnauthorizedSenderError");
		expect(err.message).toContain("stranger@evil.com");
	});

	it("creates JournalEntryNotFoundError with path", () => {
		const err = new JournalEntryNotFoundError("2026/04/07/daily.txt");
		expect(err.name).toBe("JournalEntryNotFoundError");
		expect(err.message).toContain("2026/04/07/daily.txt");
	});
});
