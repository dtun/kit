import { coldStartDataset } from "@eval/datasets/cold-start";
import { forwardedEmailDataset } from "@eval/datasets/forwarded-emails";
import { intentDataset } from "@eval/datasets/intent-classification";
import { describe, expect, it } from "vitest";

let VALID_INTENTS = new Set([
	"remember",
	"recall",
	"task",
	"question",
	"status",
	"list_view",
	"list_add",
	"list_clear",
	"edit_history",
	"calendar_view",
	"calendar_add",
	"greeting",
	"unknown",
]);

describe("intentDataset", () => {
	it("contains at least 25 cases per PRD Definition of Done", () => {
		expect(intentDataset.length).toBeGreaterThanOrEqual(25);
	});

	it("every case has a non-empty input and a valid intent", () => {
		for (let tc of intentDataset) {
			expect(tc.input.length).toBeGreaterThan(0);
			expect(VALID_INTENTS.has(tc.expected.intent)).toBe(true);
		}
	});

	it("covers every intent type at least once", () => {
		let seen = new Set<string>(intentDataset.map((tc) => tc.expected.intent));
		for (let intent of [
			"remember",
			"recall",
			"task",
			"status",
			"greeting",
			"list_view",
			"list_add",
			"list_clear",
			"edit_history",
			"calendar_view",
			"calendar_add",
		]) {
			expect(seen.has(intent)).toBe(true);
		}
	});
});

describe("forwardedEmailDataset", () => {
	it("contains at least 5 cases per PRD Definition of Done", () => {
		expect(forwardedEmailDataset.length).toBeGreaterThanOrEqual(5);
	});

	it("every case has a non-empty input and a string userInstruction", () => {
		for (let tc of forwardedEmailDataset) {
			expect(tc.input.length).toBeGreaterThan(0);
			expect(typeof tc.expected.userInstruction).toBe("string");
			expect(Array.isArray(tc.expected.keyFacts)).toBe(true);
		}
	});

	it("includes at least one non-forward control case", () => {
		let hasControl = forwardedEmailDataset.some((tc) => tc.expected.isForward === false);
		expect(hasControl).toBe(true);
	});
});

describe("coldStartDataset", () => {
	it("contains at least 5 cases per PRD Definition of Done", () => {
		expect(coldStartDataset.length).toBeGreaterThanOrEqual(5);
	});

	it("every case has shouldNotContain and shouldContain arrays", () => {
		for (let tc of coldStartDataset) {
			expect(tc.input.length).toBeGreaterThan(0);
			expect(Array.isArray(tc.expected.shouldNotContain)).toBe(true);
			expect(Array.isArray(tc.expected.shouldContain)).toBe(true);
			expect(tc.expected.shouldNotContain.length).toBeGreaterThan(0);
		}
	});

	it("every case requires '— Kit' in shouldContain", () => {
		for (let tc of coldStartDataset) {
			expect(tc.expected.shouldContain).toContain("— Kit");
		}
	});
});
