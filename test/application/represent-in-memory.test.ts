import type { ToolTurnResult } from "@application/ports/ai-service";
import { representInMemory } from "@application/use-cases/represent-in-memory";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it } from "vitest";
import { InMemoryJournalRepository, ScriptedToolAIService } from "../helpers/mocks";

let now = new Date(2026, 5, 20, 9, 0, 0); // 2026-06-20

function toolUse(id: string, name: string, input: Record<string, unknown>): ToolTurnResult {
	return { text: "", toolUses: [{ id, name, input }], stopReason: "tool_use" };
}
function stop(text: string): ToolTurnResult {
	return { text, toolUses: [], stopReason: "end_turn" };
}

function setup(turns: ToolTurnResult[]) {
	let journal = new InMemoryJournalRepository();
	let paths = createJournalPaths("journal/");
	let ai = new ScriptedToolAIService(turns);
	let dailyPath = paths.dailyLog(2026, 6, 20);
	return { journal, paths, ai, dailyPath };
}

describe("representInMemory", () => {
	it("executes a single requested tool then stops", async () => {
		let { journal, paths, ai, dailyPath } = setup([
			toolUse("t1", "add_task", { content: "Call the dentist" }),
			stop("Added the task."),
		]);

		let result = await representInMemory(
			{ journal, paths, ai, memberName: "Danny" },
			"remember to call the dentist",
			now,
		);

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("- [ ] Call the dentist");
		expect(result.writes).toEqual(["add_task"]);
		expect(result.summary).toContain("Added the task.");
	});

	it("executes multiple tool-use turns until the model stops", async () => {
		let { journal, paths, ai, dailyPath } = setup([
			toolUse("t1", "add_event", { content: "Soccer game" }),
			toolUse("t2", "add_task", { content: "Wash the jersey" }),
			stop("Done."),
		]);

		await representInMemory({ journal, paths, ai, memberName: "Danny" }, "soccer stuff", now);

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("- [o] Soccer game");
		expect(entry?.content).toContain("- [ ] Wash the jersey");
	});

	it("handles multiple tool-uses in a single turn", async () => {
		let { journal, paths, ai, dailyPath } = setup([
			{
				text: "",
				toolUses: [
					{ id: "a", name: "add_event", input: { content: "Recital" } },
					{ id: "b", name: "add_note", input: { content: "Bring flowers" } },
				],
				stopReason: "tool_use",
			},
			stop("All set."),
		]);

		let result = await representInMemory(
			{ journal, paths, ai, memberName: "Danny" },
			"recital",
			now,
		);

		let entry = await journal.read(dailyPath);
		expect(entry?.content).toContain("- [o] Recital");
		expect(entry?.content).toContain("- Bring flowers");
		expect(result.writes).toEqual(["add_event", "add_note"]);
	});

	it("reads memory before writing (recall/search tool returns context to the model)", async () => {
		let { journal, paths, ai } = setup([
			toolUse("t1", "search", { query: "dentist" }),
			stop("Already recorded — nothing to add."),
		]);
		await journal.append(paths.dailyLog(2026, 6, 20), "- [o] Dentist at 3pm\n", "seed");

		await representInMemory({ journal, paths, ai, memberName: "Danny" }, "dentist?", now);

		// The search result must have been fed back as a tool result on the 2nd turn.
		let secondCall = ai.calls[1];
		let toolTurn = secondCall.messages.find((mm) => mm.role === "tool");
		expect(toolTurn).toBeDefined();
		if (toolTurn?.role === "tool") {
			expect(toolTurn.results[0].content).toContain("Dentist at 3pm");
		}
	});

	it("carries the model's provider content onto the assistant turn it sends back", async () => {
		let providerContent = [{ type: "thinking", thinking: "check first", signature: "sig" }];
		let { journal, paths, ai } = setup([
			{ ...toolUse("t1", "search", { query: "dentist" }), providerContent },
			stop("Nothing to add."),
		]);

		await representInMemory({ journal, paths, ai, memberName: "Danny" }, "dentist?", now);

		let assistant = ai.calls[1].messages.find((mm) => mm.role === "assistant");
		expect(assistant?.role === "assistant" && assistant.providerContent).toBe(providerContent);
	});

	it("passes the bujo tool definitions to the model", async () => {
		let { journal, paths, ai } = setup([stop("nothing to do")]);

		await representInMemory({ journal, paths, ai, memberName: "Danny" }, "hi", now);

		let toolNames = ai.calls[0].tools.map((t) => t.name);
		expect(toolNames).toEqual(
			expect.arrayContaining(["add_task", "add_event", "add_note", "add_to_future_log", "search"]),
		);
	});

	it("represents a forwarded school-trip email as event + task + future-log + tag", async () => {
		// The reasoner decides this email deserves several distinct journal writes.
		let { journal, paths, ai, dailyPath } = setup([
			toolUse("s", "search", { query: "school trip Emma" }),
			{
				text: "I'll record the trip and the to-dos.",
				toolUses: [
					{ id: "e", name: "add_event", input: { content: "School trip departs @Emma #school" } },
					{
						id: "t",
						name: "add_task",
						input: { content: "Return permission slip @Emma #school" },
					},
					{ id: "c", name: "add_task", input: { content: "Pay $25 trip cost @Emma #school" } },
					{
						id: "f",
						name: "add_to_future_log",
						input: { content: "Emma's school trip #school", date: "2026-07-15" },
					},
				],
				stopReason: "tool_use",
			},
			stop("Logged Emma's school trip with the permission slip, cost, and date."),
		]);

		let result = await representInMemory(
			{ journal, paths, ai, memberName: "Danny" },
			"Forwarded: Emma's class trip July 15, permission slip due, $25 cost",
			now,
		);

		let daily = (await journal.read(dailyPath))?.content ?? "";
		let future = (await journal.read(paths.futureLog()))?.content ?? "";

		// Assert the SET of writes, not a single intent label.
		expect(result.writes).toEqual(
			expect.arrayContaining(["add_event", "add_task", "add_to_future_log"]),
		);
		expect(result.writes.filter((w) => w === "add_task")).toHaveLength(2);
		expect(daily).toContain("- [o] School trip departs");
		expect(daily).toContain("- [ ] Return permission slip");
		expect(daily).toContain("Pay $25 trip cost");
		expect(daily).toContain("#school");
		expect(daily).toContain("@Emma");
		expect(future).toContain("2026-07-15");
	});

	it("returns an error tool result when a tool throws, and keeps going", async () => {
		let { journal, paths, ai } = setup([toolUse("x", "unknown_tool", {}), stop("Recovered.")]);

		let result = await representInMemory(
			{ journal, paths, ai, memberName: "Danny" },
			"do something",
			now,
		);

		let secondCall = ai.calls[1];
		let toolTurn = secondCall.messages.find((mm) => mm.role === "tool");
		expect(toolTurn?.role === "tool" && toolTurn.results[0].isError).toBe(true);
		expect(result.summary).toContain("Recovered.");
	});

	it("stops after a safety cap even if the model keeps requesting tools", async () => {
		// Model never stops — loop must terminate to avoid an infinite loop.
		let alwaysToolUse: ToolTurnResult[] = Array.from({ length: 50 }, (_, i) =>
			toolUse(`t${i}`, "add_note", { content: `note ${i}` }),
		);
		let { journal, paths, ai } = setup(alwaysToolUse);

		await expect(
			representInMemory({ journal, paths, ai, memberName: "Danny" }, "loop", now),
		).resolves.toBeDefined();
	});
});
