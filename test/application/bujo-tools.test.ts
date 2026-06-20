import { BUJO_TOOL_DEFINITIONS, createBujoToolHandlers } from "@application/use-cases/bujo-tools";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

let now = new Date(2026, 5, 20, 9, 0, 0); // 2026-06-20

function setup() {
	let journal = new InMemoryJournalRepository();
	let paths = createJournalPaths("journal/");
	let handlers = createBujoToolHandlers({ journal, paths, memberName: "Danny" }, now);
	let dailyPath = paths.dailyLog(2026, 6, 20);
	return { journal, paths, handlers, dailyPath };
}

describe("BUJO_TOOL_DEFINITIONS", () => {
	it("exposes the memory-write and read tools", () => {
		let names = BUJO_TOOL_DEFINITIONS.map((t) => t.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"add_task",
				"add_event",
				"add_note",
				"add_to_future_log",
				"recall",
				"search",
			]),
		);
	});

	it("does not expose external-side-effect tools", () => {
		let names = BUJO_TOOL_DEFINITIONS.map((t) => t.name);
		expect(names).not.toContain("create_calendar_event");
		expect(names).not.toContain("send_message");
		expect(names).not.toContain("print");
	});

	it("each tool has a JSON-schema input definition", () => {
		for (let tool of BUJO_TOOL_DEFINITIONS) {
			expect(tool.input_schema.type).toBe("object");
			expect(tool.description.length).toBeGreaterThan(0);
		}
	});
});

describe("bujo tool handlers", () => {
	it("add_task appends an open task bullet to today's daily log", async () => {
		let { handlers, journal, dailyPath } = setup();

		await handlers.add_task({ content: "Sign the permission slip" });

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("- [ ] Sign the permission slip");
	});

	it("add_event appends an event bullet to today's daily log", async () => {
		let { handlers, journal, dailyPath } = setup();

		await handlers.add_event({ content: "Field trip to the zoo" });

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("- [o] Field trip to the zoo");
	});

	it("add_note appends a note bullet", async () => {
		let { handlers, journal, dailyPath } = setup();

		await handlers.add_note({ content: "Teacher prefers email contact" });

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("- Teacher prefers email contact");
	});

	it("add_to_future_log appends a dated event to the future log", async () => {
		let { handlers, journal, paths } = setup();

		await handlers.add_to_future_log({ content: "School trip", date: "2026-07-15" });

		let entry = await journal.read(paths.futureLog());
		expect(entry?.content).toContain("School trip");
		expect(entry?.content).toContain("2026-07-15");
	});

	it("supports @person and #tag in content", async () => {
		let { handlers, journal, dailyPath } = setup();

		await handlers.add_task({ content: "Pack lunch @Emma #school" });

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("@Emma");
		expect(entry?.content).toContain("#school");
	});

	it("search returns matching journal entries as text", async () => {
		let { handlers, journal, dailyPath } = setup();
		await journal.append(dailyPath, "- [o] Dentist appointment\n", "seed");

		let result = await handlers.search({ query: "Dentist" });

		expect(result).toContain("Dentist appointment");
	});

	it("search reports when nothing is found", async () => {
		let { handlers } = setup();

		let result = await handlers.search({ query: "nonexistent" });

		expect(result.toLowerCase()).toContain("no");
	});

	it("recall is an alias for search over the journal", async () => {
		let { handlers, journal, dailyPath } = setup();
		await journal.append(dailyPath, "- [ ] Buy soccer cleats\n", "seed");

		let result = await handlers.recall({ query: "soccer" });

		expect(result).toContain("soccer cleats");
	});

	it("records the writes it makes so the loop can report them", async () => {
		let { handlers } = setup();

		await handlers.add_task({ content: "A" });
		await handlers.add_event({ content: "B" });

		expect(handlers.writes).toContain("add_task");
		expect(handlers.writes).toContain("add_event");
	});
});
