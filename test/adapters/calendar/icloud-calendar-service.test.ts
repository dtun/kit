import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let { mockCreateDAVClient } = vi.hoisted(() => ({
	mockCreateDAVClient: vi.fn(),
}));

vi.mock("tsdav", () => ({
	createDAVClient: mockCreateDAVClient,
}));

import {
	ICloudCalendarService,
	buildICS,
	parseICSToEvent,
} from "@adapters/calendar/icloud-calendar-service";

interface MockCalendar {
	displayName: string;
	url: string;
}

interface MockClient {
	fetchCalendars: ReturnType<typeof vi.fn>;
	fetchCalendarObjects: ReturnType<typeof vi.fn>;
	createCalendarObject: ReturnType<typeof vi.fn>;
}

function makeMockClient(calendars: MockCalendar[] = []): MockClient {
	return {
		fetchCalendars: vi.fn().mockResolvedValue(calendars),
		fetchCalendarObjects: vi.fn().mockResolvedValue([]),
		createCalendarObject: vi.fn().mockResolvedValue({}),
	};
}

describe("ICloudCalendarService", () => {
	let mockClient: MockClient;

	beforeEach(() => {
		mockClient = makeMockClient([
			{ displayName: "Family", url: "/cal/family" },
			{ displayName: "Work", url: "/cal/work" },
		]);
		mockCreateDAVClient.mockResolvedValue(mockClient);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getClient (lazy init)", () => {
		it("creates DAV client with iCloud URL and Basic auth", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx-xxxx-xxxx-xxxx");
			await service.listCalendars();

			expect(mockCreateDAVClient).toHaveBeenCalledWith({
				serverUrl: "https://caldav.icloud.com",
				credentials: {
					username: "kit@icloud.com",
					password: "xxxx-xxxx-xxxx-xxxx",
				},
				authMethod: "Basic",
				defaultAccountType: "caldav",
			});
		});

		it("reuses client on subsequent calls", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			await service.listCalendars();
			await service.listCalendars();

			expect(mockCreateDAVClient).toHaveBeenCalledTimes(1);
		});
	});

	describe("listCalendars", () => {
		it("returns calendar names and IDs", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			let cals = await service.listCalendars();

			expect(cals).toEqual([
				{ name: "Family", id: "/cal/family", readOnly: false },
				{ name: "Work", id: "/cal/work", readOnly: false },
			]);
		});
	});

	describe("fetchEvents", () => {
		it("calls fetchCalendarObjects with correct timeRange", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			let start = new Date("2026-04-09T00:00:00Z");
			let end = new Date("2026-04-10T00:00:00Z");

			await service.fetchEvents({ start, end });

			expect(mockClient.fetchCalendarObjects).toHaveBeenCalledTimes(2);
			let firstCall = mockClient.fetchCalendarObjects.mock.calls[0][0];
			expect(firstCall).toMatchObject({
				timeRange: {
					start: start.toISOString(),
					end: end.toISOString(),
				},
			});
		});

		it("filters calendars by name when calendarNames is provided", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");

			await service.fetchEvents({
				start: new Date("2026-04-09"),
				end: new Date("2026-04-10"),
				calendarNames: ["Family"],
			});

			expect(mockClient.fetchCalendarObjects).toHaveBeenCalledTimes(1);
		});

		it("parses ICS objects into CalendarEvent array sorted by startDate", async () => {
			let laterICS = [
				"BEGIN:VCALENDAR",
				"BEGIN:VEVENT",
				"UID:evt-2",
				"SUMMARY:Dentist",
				"DTSTART:20260409T200000Z",
				"DTEND:20260409T210000Z",
				"END:VEVENT",
				"END:VCALENDAR",
			].join("\r\n");
			let earlierICS = [
				"BEGIN:VCALENDAR",
				"BEGIN:VEVENT",
				"UID:evt-1",
				"SUMMARY:Soccer",
				"DTSTART:20260409T160000Z",
				"DTEND:20260409T173000Z",
				"LOCATION:Mesa Sports Complex",
				"END:VEVENT",
				"END:VCALENDAR",
			].join("\r\n");

			mockClient.fetchCalendarObjects.mockResolvedValue([
				{ data: laterICS, url: "/1.ics", etag: "a" },
				{ data: earlierICS, url: "/2.ics", etag: "b" },
			]);

			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			let events = await service.fetchEvents({
				start: new Date("2026-04-09"),
				end: new Date("2026-04-10"),
				calendarNames: ["Family"],
			});

			expect(events).toHaveLength(2);
			expect(events[0].summary).toBe("Soccer");
			expect(events[0].location).toBe("Mesa Sports Complex");
			expect(events[1].summary).toBe("Dentist");
		});
	});

	describe("createEvent", () => {
		it("calls createCalendarObject with generated ICS", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");

			let event = await service.createEvent({
				summary: "Piano Lesson",
				startDate: "2026-04-09T17:30:00Z",
			});

			expect(event.summary).toBe("Piano Lesson");
			expect(event.uid).toBeTruthy();
			expect(mockClient.createCalendarObject).toHaveBeenCalledOnce();

			let callArgs = mockClient.createCalendarObject.mock.calls[0][0];
			expect(callArgs.iCalString).toContain("SUMMARY:Piano Lesson");
			expect(callArgs.filename).toMatch(/\.ics$/);
		});

		it("defaults to first calendar when calendarName not specified", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			await service.createEvent({
				summary: "Test",
				startDate: "2026-04-09T10:00:00Z",
			});

			let callArgs = mockClient.createCalendarObject.mock.calls[0][0];
			expect(callArgs.calendar).toMatchObject({ displayName: "Family" });
		});

		it("throws when target calendar not found", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			await expect(
				service.createEvent({
					summary: "Test",
					startDate: "2026-04-09T10:00:00Z",
					calendarName: "NonExistent",
				}),
			).rejects.toThrow("Calendar not found");
		});
	});

	describe("updateEvent / deleteEvent", () => {
		it("throws not implemented", async () => {
			let service = new ICloudCalendarService("kit@icloud.com", "xxxx");
			await expect(service.updateEvent("uid", {})).rejects.toThrow("Not implemented");
			await expect(service.deleteEvent("uid")).rejects.toThrow("Not implemented");
		});
	});
});

describe("parseICSToEvent", () => {
	it("extracts UID, SUMMARY, LOCATION, DESCRIPTION", () => {
		let ics = [
			"BEGIN:VEVENT",
			"UID:abc-123",
			"SUMMARY:Soccer Practice",
			"LOCATION:Mesa Park",
			"DESCRIPTION:Bring shin guards",
			"DTSTART:20260409T160000Z",
			"DTEND:20260409T173000Z",
			"END:VEVENT",
		].join("\r\n");

		let event = parseICSToEvent(ics, "Family");
		expect(event).not.toBeNull();
		expect(event!.uid).toBe("abc-123");
		expect(event!.summary).toBe("Soccer Practice");
		expect(event!.location).toBe("Mesa Park");
		expect(event!.description).toBe("Bring shin guards");
		expect(event!.calendarName).toBe("Family");
	});

	it("parses VALUE=DATE as all-day event", () => {
		let ics = [
			"BEGIN:VEVENT",
			"UID:day-1",
			"SUMMARY:Belt Test",
			"DTSTART;VALUE=DATE:20260418",
			"DTEND;VALUE=DATE:20260419",
			"END:VEVENT",
		].join("\r\n");

		let event = parseICSToEvent(ics, "Family");
		expect(event!.allDay).toBe(true);
		expect(event!.startDate).toBe("2026-04-18");
	});

	it("parses timed DTSTART as non-all-day event", () => {
		let ics = [
			"BEGIN:VEVENT",
			"UID:time-1",
			"SUMMARY:Meeting",
			"DTSTART:20260409T140000Z",
			"DTEND:20260409T150000Z",
			"END:VEVENT",
		].join("\r\n");

		let event = parseICSToEvent(ics, "Work");
		expect(event!.allDay).toBe(false);
		expect(event!.startDate).toBe("2026-04-09T14:00:00Z");
	});

	it("detects recurrence via RRULE", () => {
		let ics = [
			"BEGIN:VEVENT",
			"UID:rec-1",
			"SUMMARY:Weekly Standup",
			"DTSTART:20260409T090000Z",
			"DTEND:20260409T093000Z",
			"RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
			"END:VEVENT",
		].join("\r\n");

		let event = parseICSToEvent(ics, "Work");
		expect(event!.recurring).toBe(true);
	});

	it("returns null when DTSTART is missing", () => {
		let ics = "BEGIN:VEVENT\r\nUID:bad\r\nSUMMARY:No Date\r\nEND:VEVENT";
		expect(parseICSToEvent(ics, "Family")).toBeNull();
	});
});

describe("buildICS", () => {
	it("builds valid ICS for a timed event", () => {
		let ics = buildICS("uid-1", {
			summary: "Soccer Practice",
			startDate: "2026-04-09T16:00:00Z",
		});

		expect(ics).toContain("BEGIN:VCALENDAR");
		expect(ics).toContain("BEGIN:VEVENT");
		expect(ics).toContain("UID:uid-1");
		expect(ics).toContain("SUMMARY:Soccer Practice");
		expect(ics).toContain("DTSTART:20260409T160000Z");
		expect(ics).toContain("END:VEVENT");
		expect(ics).toContain("END:VCALENDAR");
	});

	it("uses VALUE=DATE for all-day events", () => {
		let ics = buildICS("uid-2", {
			summary: "Belt Test",
			startDate: "2026-04-18T00:00:00Z",
			allDay: true,
		});

		expect(ics).toContain("DTSTART;VALUE=DATE:20260418");
		expect(ics).toContain("DTEND;VALUE=DATE:");
	});

	it("defaults endDate to 1 hour after start when not provided", () => {
		let ics = buildICS("uid-3", {
			summary: "Quick Meeting",
			startDate: "2026-04-09T14:00:00Z",
		});

		expect(ics).toContain("DTEND:20260409T150000Z");
	});

	it("includes VALARM for reminders", () => {
		let ics = buildICS("uid-4", {
			summary: "Dentist",
			startDate: "2026-04-10T15:00:00Z",
			reminders: [15, 60],
		});

		expect(ics).toContain("BEGIN:VALARM");
		expect(ics).toContain("TRIGGER:-PT15M");
		expect(ics).toContain("TRIGGER:-PT60M");
		expect(ics).toContain("END:VALARM");
	});

	it("escapes special characters in summary and description", () => {
		let ics = buildICS("uid-5", {
			summary: "Soccer, Game; Important",
			startDate: "2026-04-09T10:00:00Z",
			description: "Bring: water, snacks; towel",
		});

		expect(ics).toContain("SUMMARY:Soccer\\, Game\\; Important");
		expect(ics).toContain("DESCRIPTION:Bring: water\\, snacks\\; towel");
	});

	it("includes LOCATION when provided", () => {
		let ics = buildICS("uid-6", {
			summary: "Game",
			startDate: "2026-04-12T10:00:00Z",
			location: "Mesa Sports Complex",
		});

		expect(ics).toContain("LOCATION:Mesa Sports Complex");
	});
});
