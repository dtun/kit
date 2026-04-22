import type {
	CalendarCreateRequest,
	CalendarEvent,
	CalendarQuery,
} from "@domain/entities/calendar-event";
import { describe, expect, it } from "vitest";

describe("CalendarEvent entity", () => {
	it("represents an all-day event", () => {
		let event: CalendarEvent = {
			uid: "abc-123",
			summary: "Combatives Belt Test",
			startDate: "2026-04-18",
			endDate: "2026-04-18",
			allDay: true,
			recurring: false,
			calendarName: "Family",
		};
		expect(event.allDay).toBe(true);
		expect(event.summary).toContain("Belt Test");
	});

	it("represents a timed recurring event with all optional fields", () => {
		let event: CalendarEvent = {
			uid: "def-456",
			summary: "Soccer Practice",
			description: "Bring shin guards",
			location: "Mesa Sports Complex",
			startDate: "2026-04-09T16:00:00Z",
			endDate: "2026-04-09T17:30:00Z",
			allDay: false,
			recurring: true,
			calendarName: "Family",
			attendees: ["Danny", "Coach Bob"],
			reminders: [15, 60],
		};
		expect(event.recurring).toBe(true);
		expect(event.attendees).toHaveLength(2);
		expect(event.reminders).toEqual([15, 60]);
	});
});

describe("CalendarQuery", () => {
	it("accepts a date range with optional calendar filter", () => {
		let query: CalendarQuery = {
			start: new Date("2026-04-07"),
			end: new Date("2026-04-14"),
			calendarNames: ["Family"],
		};
		expect(query.calendarNames).toEqual(["Family"]);
	});

	it("works without calendarNames filter", () => {
		let query: CalendarQuery = {
			start: new Date("2026-04-07"),
			end: new Date("2026-04-14"),
		};
		expect(query.calendarNames).toBeUndefined();
	});
});

describe("CalendarCreateRequest", () => {
	it("accepts minimal required fields", () => {
		let request: CalendarCreateRequest = {
			summary: "Dentist",
			startDate: "2026-04-10T15:00:00Z",
		};
		expect(request.summary).toBe("Dentist");
		expect(request.endDate).toBeUndefined();
		expect(request.allDay).toBeUndefined();
	});

	it("accepts all optional fields", () => {
		let request: CalendarCreateRequest = {
			summary: "Soccer Game",
			startDate: "2026-04-12T10:00:00Z",
			endDate: "2026-04-12T12:00:00Z",
			allDay: false,
			location: "Mesa Sports Complex",
			description: "Bring water bottles",
			calendarName: "Family",
			reminders: [30],
		};
		expect(request.location).toBe("Mesa Sports Complex");
		expect(request.reminders).toEqual([30]);
	});
});
