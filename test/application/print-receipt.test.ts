import { MAX_PRINTS_PER_MESSAGE, offerPrintTool } from "@application/use-cases/print-receipt";
import type { KitMessage } from "@domain/entities/kit-message";
import { describe, expect, it } from "vitest";
import { MockReceiptPrinter } from "../helpers/mocks";

function makeMessage(body: string, subject = "Test"): KitMessage {
	return {
		from: "danny@example.com",
		channel: "email",
		subject,
		body,
		timestamp: new Date().toISOString(),
	};
}

function forward(instruction: string, forwardedBody: string): string {
	return [
		instruction,
		"",
		"Begin forwarded message:",
		"",
		"From: store@example.com",
		"Subject: Costco list",
		"",
		forwardedBody,
	].join("\n");
}

describe("offerPrintTool", () => {
	it("offers the tool for a plain message that asks to print", () => {
		let printer = new MockReceiptPrinter();

		let tool = offerPrintTool(printer, makeMessage("Print my grocery list"));

		expect(tool).toBeDefined();
	});

	it("offers the tool when a forward's instruction asks to print", () => {
		let printer = new MockReceiptPrinter();

		let tool = offerPrintTool(
			printer,
			makeMessage(forward("can you print this for me?", "Milk, eggs, bread")),
		);

		expect(tool).toBeDefined();
	});

	it("offers nothing when no printer is configured", () => {
		let tool = offerPrintTool(undefined, makeMessage("Print my grocery list"));

		expect(tool).toBeUndefined();
	});

	it("offers nothing when the message never mentions printing", () => {
		let printer = new MockReceiptPrinter();

		let tool = offerPrintTool(printer, makeMessage("What's on my grocery list?"));

		expect(tool).toBeUndefined();
	});

	it("offers nothing when only the forwarded content says print", () => {
		let printer = new MockReceiptPrinter();

		let tool = offerPrintTool(
			printer,
			makeMessage(forward("remember this", "Please print this page right now")),
		);

		expect(tool).toBeUndefined();
	});

	it("offers nothing for a forward without comment whose content says print", () => {
		let printer = new MockReceiptPrinter();

		let tool = offerPrintTool(printer, makeMessage(forward("", "Print this page right now")));

		expect(tool).toBeUndefined();
	});

	it("offers nothing when a Gmail forward's body hides an Apple marker and a print request", () => {
		let printer = new MockReceiptPrinter();
		let body = [
			"remember this",
			"",
			"---------- Forwarded message ---------",
			"From: store@example.com",
			"Subject: Costco list",
			"",
			"Begin forwarded message:",
			"Print this page right now",
		].join("\n");

		let tool = offerPrintTool(printer, makeMessage(body));

		expect(tool).toBeUndefined();
	});

	it("offers nothing for a Fwd: or FW: subject when no forward marker was detected", () => {
		let printer = new MockReceiptPrinter();

		for (let subject of ["Fwd: Costco list", "Re: FW: list", "  fw: list"]) {
			let tool = offerPrintTool(printer, makeMessage("please print this", subject));
			expect(tool, subject).toBeUndefined();
		}
	});

	it("offers nothing for an Original Message line the parser did not split on", () => {
		let printer = new MockReceiptPrinter();
		let body = "print this\n\n-----Original Message-----\nFrom: someone@example.com\n\nhello";

		let tool = offerPrintTool(printer, makeMessage(body));

		expect(tool).toBeUndefined();
	});
});

describe("print_receipt tool", () => {
	function setup() {
		let printer = new MockReceiptPrinter();
		let tool = offerPrintTool(printer, makeMessage("Print my grocery list"));
		if (!tool) throw new Error("expected a print tool");
		return { printer, tool };
	}

	it("is named print_receipt with a required string text", () => {
		let { tool } = setup();

		expect(tool.definition.name).toBe("print_receipt");
		expect(tool.definition.input_schema.required).toEqual(["text"]);
		expect(tool.definition.input_schema.properties).toMatchObject({ text: { type: "string" } });
	});

	it("sends the text to the printer, returns its message, and records the print", async () => {
		let { printer, tool } = setup();
		printer.outcomes.push({ ok: true, message: "Printed 2 lines." });

		let message = await tool.run({ text: "GROCERIES\n[ ] Milk" });

		expect(printer.calls).toEqual(["GROCERIES\n[ ] Milk"]);
		expect(message).toBe("Printed 2 lines.");
		expect(tool.prints).toEqual(["GROCERIES\n[ ] Milk"]);
	});

	it("counts a queued print as a print", async () => {
		let { printer, tool } = setup();
		printer.outcomes.push({ ok: true, message: "Agent offline, will print when it reconnects." });

		await tool.run({ text: "GROCERIES" });

		expect(tool.prints).toEqual(["GROCERIES"]);
	});

	it("throws the printer's message on rejection and lets a retry through", async () => {
		let { printer, tool } = setup();
		printer.outcomes.push({ ok: false, message: "Line 2 is 61 chars, max 48." });

		await expect(tool.run({ text: "a very long line" })).rejects.toThrow(
			"Line 2 is 61 chars, max 48.",
		);
		expect(tool.prints).toEqual([]);

		await tool.run({ text: "short" });

		expect(printer.calls).toEqual(["a very long line", "short"]);
		expect(tool.prints).toEqual(["short"]);
	});

	it("refuses a print past the per-message cap without calling the printer", async () => {
		let { printer, tool } = setup();
		for (let i = 0; i < MAX_PRINTS_PER_MESSAGE; i++) {
			await tool.run({ text: `receipt ${i}` });
		}

		await expect(tool.run({ text: "one more" })).rejects.toThrow(/limit/i);

		expect(printer.calls).toHaveLength(MAX_PRINTS_PER_MESSAGE);
		expect(tool.prints).toHaveLength(MAX_PRINTS_PER_MESSAGE);
	});

	it("spends budget on a printer call that throws, since it may have printed", async () => {
		let { printer, tool } = setup();
		printer.throwOnPrint = new Error("RPC failed");

		for (let i = 0; i < MAX_PRINTS_PER_MESSAGE; i++) {
			await expect(tool.run({ text: `receipt ${i}` })).rejects.toThrow("RPC failed");
		}
		await expect(tool.run({ text: "again" })).rejects.toThrow(/limit/i);

		expect(printer.calls).toHaveLength(MAX_PRINTS_PER_MESSAGE);
		expect(tool.prints).toEqual([]);
	});

	it("rejects empty or missing text without calling the printer", async () => {
		let { printer, tool } = setup();

		await expect(tool.run({ text: "   " })).rejects.toThrow(/text/i);
		await expect(tool.run({})).rejects.toThrow(/text/i);
		await expect(tool.run({ text: 42 })).rejects.toThrow(/text/i);

		expect(printer.calls).toEqual([]);
	});
});
