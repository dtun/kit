import { parseBulletLine, serializeBullet } from "@domain/entities/bullet-parser";
import { describe, expect, it } from "vitest";

describe("parseBulletLine", () => {
	it("parses an open task", () => {
		const entry = parseBulletLine("- [ ] Buy milk");
		expect(entry).not.toBeNull();
		expect(entry!.type).toBe("task");
		expect(entry!.state).toBe("open");
		expect(entry!.content).toBe("Buy milk");
	});

	it("parses a completed task", () => {
		const entry = parseBulletLine("- [x] Buy milk");
		expect(entry!.state).toBe("completed");
	});

	it("parses a migrated task", () => {
		const entry = parseBulletLine("- [>] Buy milk");
		expect(entry!.state).toBe("migrated");
	});

	it("parses a scheduled task", () => {
		const entry = parseBulletLine("- [<] Buy milk → future-log");
		expect(entry!.state).toBe("scheduled");
	});

	it("parses a cancelled task", () => {
		const entry = parseBulletLine("- [-] Buy milk");
		expect(entry!.state).toBe("cancelled");
	});

	it("parses an event", () => {
		const entry = parseBulletLine("- [o] Soccer game at 10am");
		expect(entry!.type).toBe("event");
		expect(entry!.content).toBe("Soccer game at 10am");
	});

	it("parses a note", () => {
		const entry = parseBulletLine("- Plumber said it's a cracked pipe");
		expect(entry!.type).toBe("note");
	});

	it("parses priority signifier", () => {
		const entry = parseBulletLine("! - [ ] Pay rent");
		expect(entry!.signifiers).toContain("priority");
		expect(entry!.content).toBe("Pay rent");
	});

	it("extracts @person references", () => {
		const entry = parseBulletLine("- [ ] @Danny call plumber");
		expect(entry!.person).toBe("Danny");
	});

	it("extracts #tags", () => {
		const entry = parseBulletLine("- [ ] Buy milk #groceries #urgent");
		expect(entry!.tags).toContain("groceries");
		expect(entry!.tags).toContain("urgent");
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
		const line = serializeBullet({
			type: "task",
			state: "open",
			signifiers: [],
			content: "Buy milk",
			tags: [],
		});
		expect(line).toBe("- [ ] Buy milk");
	});

	it("serializes a priority task", () => {
		const line = serializeBullet({
			type: "task",
			state: "open",
			signifiers: ["priority"],
			content: "Pay rent",
			tags: [],
		});
		expect(line).toBe("! - [ ] Pay rent");
	});

	it("serializes an event", () => {
		const line = serializeBullet({
			type: "event",
			signifiers: [],
			content: "Soccer at 10am",
			tags: [],
		});
		expect(line).toBe("- [o] Soccer at 10am");
	});

	it("serializes a note", () => {
		const line = serializeBullet({
			type: "note",
			signifiers: [],
			content: "Plumber costs $200",
			tags: [],
		});
		expect(line).toBe("- Plumber costs $200");
	});

	it("round-trips: parse then serialize", () => {
		const original = "! - [ ] Pay rent #bills";
		const parsed = parseBulletLine(original);
		const serialized = serializeBullet(parsed!);
		expect(serialized).toBe("! - [ ] Pay rent #bills");
	});
});
