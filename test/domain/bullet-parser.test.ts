import { parseBulletLine, serializeBullet } from "@domain/entities/bullet-parser";
import { describe, expect, it } from "vitest";

describe("parseBulletLine", () => {
	it("parses an open task", () => {
		let entry = parseBulletLine("- [ ] Buy milk");
		expect(entry).not.toBeNull();
		expect(entry?.type).toBe("task");
		expect(entry?.state).toBe("open");
		expect(entry?.content).toBe("Buy milk");
	});

	it("parses a completed task", () => {
		let entry = parseBulletLine("- [x] Buy milk");
		expect(entry?.state).toBe("completed");
	});

	it("parses a migrated task", () => {
		let entry = parseBulletLine("- [>] Buy milk");
		expect(entry?.state).toBe("migrated");
	});

	it("parses a scheduled task", () => {
		let entry = parseBulletLine("- [<] Buy milk → future-log");
		expect(entry?.state).toBe("scheduled");
	});

	it("parses a cancelled task", () => {
		let entry = parseBulletLine("- [-] Buy milk");
		expect(entry?.state).toBe("cancelled");
	});

	it("parses an event", () => {
		let entry = parseBulletLine("- [o] Soccer game at 10am");
		expect(entry?.type).toBe("event");
		expect(entry?.content).toBe("Soccer game at 10am");
	});

	it("parses a note", () => {
		let entry = parseBulletLine("- Plumber said it's a cracked pipe");
		expect(entry?.type).toBe("note");
	});

	it("parses priority signifier", () => {
		let entry = parseBulletLine("! - [ ] Pay rent");
		expect(entry?.signifiers).toContain("priority");
		expect(entry?.content).toBe("Pay rent");
	});

	it("extracts @person references", () => {
		let entry = parseBulletLine("- [ ] @Danny call plumber");
		expect(entry?.person).toBe("Danny");
	});

	it("extracts #tags", () => {
		let entry = parseBulletLine("- [ ] Buy milk #groceries #urgent");
		expect(entry?.tags).toContain("groceries");
		expect(entry?.tags).toContain("urgent");
	});

	it("returns null for empty lines", () => {
		expect(parseBulletLine("")).toBeNull();
		expect(parseBulletLine("   ")).toBeNull();
	});

	it("returns null for headers", () => {
		expect(parseBulletLine("# Tasks")).toBeNull();
		expect(parseBulletLine("## Events")).toBeNull();
	});
});

describe("serializeBullet", () => {
	it("serializes an open task", () => {
		let line = serializeBullet({
			type: "task",
			state: "open",
			signifiers: [],
			content: "Buy milk",
			tags: [],
		});
		expect(line).toBe("- [ ] Buy milk");
	});

	it("serializes a priority task", () => {
		let line = serializeBullet({
			type: "task",
			state: "open",
			signifiers: ["priority"],
			content: "Pay rent",
			tags: [],
		});
		expect(line).toBe("! - [ ] Pay rent");
	});

	it("serializes an event", () => {
		let line = serializeBullet({
			type: "event",
			signifiers: [],
			content: "Soccer at 10am",
			tags: [],
		});
		expect(line).toBe("- [o] Soccer at 10am");
	});

	it("serializes a note", () => {
		let line = serializeBullet({
			type: "note",
			signifiers: [],
			content: "Plumber costs $200",
			tags: [],
		});
		expect(line).toBe("- Plumber costs $200");
	});

	it("round-trips: parse then serialize", () => {
		let original = "! - [ ] Pay rent #bills";
		let parsed = parseBulletLine(original);
		// biome-ignore lint/style/noNonNullAssertion: test asserts parsed is non-null
		let serialized = serializeBullet(parsed!);
		expect(serialized).toBe("! - [ ] Pay rent #bills");
	});
});
