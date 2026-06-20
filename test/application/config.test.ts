import { parseFamilyMembersSafe } from "@config";
import { describe, expect, it } from "vitest";

describe("parseFamilyMembersSafe", () => {
	it("returns ok:false for undefined input", () => {
		let result = parseFamilyMembersSafe(undefined);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeTruthy();
		}
	});

	it("returns ok:false for empty string input", () => {
		let result = parseFamilyMembersSafe("");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeTruthy();
		}
	});

	it("returns ok:false for invalid JSON", () => {
		let result = parseFamilyMembersSafe("{not json");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeTruthy();
		}
	});

	it("returns ok:false for schema-invalid array", () => {
		let result = parseFamilyMembersSafe(JSON.stringify([{ name: "Dad" }]));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeTruthy();
		}
	});

	it("returns ok:true with members for valid input", () => {
		let raw = JSON.stringify([{ name: "Dad", contact: "dad@example.com", channel: "email" }]);
		let result = parseFamilyMembersSafe(raw);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.members).toHaveLength(1);
			expect(result.members[0]).toMatchObject({
				name: "Dad",
				contact: "dad@example.com",
				channel: "email",
			});
		}
	});
});
