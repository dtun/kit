import {
	dailyLogTemplate,
	editLogLine,
	futureLogTemplate,
	indexTemplate,
	monthlyLogTemplate,
} from "@domain/entities/templates";
import { describe, expect, it } from "vitest";

describe("Templates", () => {
	it("generates daily log with date header", () => {
		let tmpl = dailyLogTemplate(new Date(2026, 3, 7), "Tuesday");
		expect(tmpl).toContain("Tuesday, April 7, 2026");
		expect(tmpl).toContain("## Tasks");
		expect(tmpl).toContain("## Events");
		expect(tmpl).toContain("## Notes");
	});

	it("generates monthly log with month and year", () => {
		let tmpl = monthlyLogTemplate(2026, "April");
		expect(tmpl).toContain("# April 2026");
		expect(tmpl).toContain("## Recurring");
	});

	it("generates future log with correct number of months", () => {
		let tmpl = futureLogTemplate(new Date(2026, 3, 1), 3);
		expect(tmpl).toContain("April 2026");
		expect(tmpl).toContain("May 2026");
		expect(tmpl).toContain("June 2026");
	});

	it("generates index with standard sections", () => {
		let tmpl = indexTemplate();
		expect(tmpl).toContain("# Kit Journal Index");
		expect(tmpl).toContain("## People");
		expect(tmpl).toContain("## Tags");
	});

	it("formats edit log line correctly", () => {
		let line = editLogLine(
			"2026-04-07T09:15:00Z",
			"create",
			"journal/2026/04/07/daily.txt",
			"New day",
		);
		expect(line).toBe("[2026-04-07T09:15:00Z] CREATE journal/2026/04/07/daily.txt — New day");
	});
});
