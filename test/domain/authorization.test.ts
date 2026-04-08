import { authorizeSender } from "@domain/entities/authorization";
import { describe, expect, it } from "vitest";

const family = [
	{ name: "Danny", contact: "danny@example.com", channel: "email" as const },
	{ name: "Wife", contact: "wife@example.com", channel: "email" as const },
];

describe("authorizeSender", () => {
	it("authorizes a known family member", () => {
		const result = authorizeSender("danny@example.com", family);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("is case-insensitive", () => {
		const result = authorizeSender("DANNY@EXAMPLE.COM", family);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("trims whitespace", () => {
		const result = authorizeSender("  danny@example.com  ", family);
		expect(result.authorized).toBe(true);
	});

	it("rejects unknown senders", () => {
		const result = authorizeSender("stranger@evil.com", family);
		expect(result.authorized).toBe(false);
		expect(result.member).toBeNull();
		expect(result.reason).toContain("stranger@evil.com");
	});
});
