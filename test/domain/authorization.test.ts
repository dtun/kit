import { authorizeSender } from "@domain/entities/authorization";
import { describe, expect, it } from "vitest";

let family = [
	{ name: "Danny", contact: "danny@example.com", channel: "email" as const },
	{ name: "Wife", contact: "wife@example.com", channel: "email" as const },
];

describe("authorizeSender", () => {
	it("authorizes a known family member", () => {
		let result = authorizeSender("danny@example.com", family);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("is case-insensitive", () => {
		let result = authorizeSender("DANNY@EXAMPLE.COM", family);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("trims whitespace", () => {
		let result = authorizeSender("  danny@example.com  ", family);
		expect(result.authorized).toBe(true);
	});

	it("authorizes a sender matching an alias", () => {
		let withAlias = [
			{
				name: "Danny",
				contact: "danny@example.com",
				channel: "email" as const,
				aliases: ["danny.work@example.com"],
			},
		];
		let result = authorizeSender("danny.work@example.com", withAlias);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("matches an alias case-insensitively and trimmed", () => {
		let withAlias = [
			{
				name: "Danny",
				contact: "danny@example.com",
				channel: "email" as const,
				aliases: ["Danny.Work@Example.com"],
			},
		];
		let result = authorizeSender("  DANNY.WORK@example.COM  ", withAlias);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("authorizes a sender given in display-name form matching contact", () => {
		let result = authorizeSender("Danny <danny@example.com>", family);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("authorizes a sender in display-name form matching an alias", () => {
		let withAlias = [
			{
				name: "Danny",
				contact: "danny@example.com",
				channel: "email" as const,
				aliases: ["danny.work@example.com"],
			},
		];
		let result = authorizeSender("Danny Work <danny.work@example.com>", withAlias);
		expect(result.authorized).toBe(true);
		expect(result.member?.name).toBe("Danny");
	});

	it("rejects unknown senders", () => {
		let result = authorizeSender("stranger@evil.com", family);
		expect(result.authorized).toBe(false);
		expect(result.member).toBeNull();
		expect(result.reason).toContain("stranger@evil.com");
	});
});
