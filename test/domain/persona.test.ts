import { CHANNEL_TONE, KIT_PERSONA } from "@domain/entities/persona";
import { describe, expect, it } from "vitest";

describe("KIT_PERSONA", () => {
	it("has a name and full name", () => {
		expect(KIT_PERSONA.name).toBe("Kit");
		expect(KIT_PERSONA.fullName).toBe("Kinetic Intelligence Tool");
	});

	it("has personality traits defined", () => {
		expect(KIT_PERSONA.traits.length).toBeGreaterThan(0);
	});

	it("has reply rules defined", () => {
		expect(KIT_PERSONA.rules.length).toBeGreaterThan(0);
		expect(KIT_PERSONA.rules.some((r) => r.includes("2-4 sentences"))).toBe(true);
	});

	it("has a sign-off", () => {
		expect(KIT_PERSONA.signOff).toBe("- Kit");
	});
});

describe("CHANNEL_TONE", () => {
	it("defines a brief tone for SMS", () => {
		expect(CHANNEL_TONE.sms).toContain("brief");
		expect(CHANNEL_TONE.sms).toContain("1-2 sentences");
	});

	it("includes sign-off instruction for SMS", () => {
		expect(CHANNEL_TONE.sms.toLowerCase()).toContain("sign off");
		expect(CHANNEL_TONE.sms).toContain("- Kit");
	});

	it("defines a longer tone for email", () => {
		expect(CHANNEL_TONE.email).toContain("2-4 sentences");
	});

	it("includes sign-off instruction for email", () => {
		expect(CHANNEL_TONE.email.toLowerCase()).toContain("sign off");
		expect(CHANNEL_TONE.email).toContain("- Kit");
	});
});
