import { KIT_PERSONA } from "@domain/entities/persona";
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
		expect(KIT_PERSONA.signOff).toBe("\u2014 Kit");
	});
});
