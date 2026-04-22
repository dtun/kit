import type { ICalendarService } from "@application/ports/calendar-service";
import { createDateContext } from "@domain/entities/date-context";
import type { CalendarEvent, CalendarQuery } from "@domain/entities/calendar-event";
import { describe, expect, it, vi } from "vitest";
import { fetchUpcomingEvents } from "@application/use-cases/fetch-upcoming-events";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		uid: "evt-1",
		summary: "Test Event",
		startDate: "2026-04-09T16:00:00Z",
		endDate: "2026-04-09T17:00:00Z",
		allDay: false,
		recurring: false,
		calendarName: "Family",
		...overrides,
	};
}

function createMockCalendar(events: CalendarEvent[] = []): ICalendarService {
	return {
		listCalendars: vi.fn().mockResolvedValue([]),
		fetchEvents: vi.fn().mockResolvedValue(events),
		createEvent: vi.fn(),
		updateEvent: vi.fn(),
		deleteEvent: vi.fn(),
	};
}

describe("fetchUpcomingEvents", () => {
	// Wednesday April 9, 2026
	let now = new Date(2026, 3, 9, 8, 0, 0);
	let dateCtx = createDateContext(now);

	it("queries three non-overlapping date ranges", async () => {
		let calendar = createMockCalendar();
		await fetchUpcomingEvents({ calendar }, dateCtx);

		let calls = vi.mocked(calendar.fetchEvents).mock.calls;
		expect(calls).toHaveLength(3);

		// Today: midnight Apr 9 to midnight Apr 10
		let todayRange = calls[0][0];
		expect(todayRange.start.getDate()).toBe(9);
		expect(todayRange.end.getDate()).toBe(10);

		// This week: Apr 10 to end of Saturday Apr 12 (Apr 9 is Wed, 3 days left)
		let weekRange = calls[1][0];
		expect(weekRange.start.getDate()).toBe(10);
		expect(weekRange.end.getDate()).toBe(12);

		// Next week: Sunday Apr 12 to Saturday Apr 18+1
		let nextRange = calls[2][0];
		expect(nextRange.start.getDate()).toBe(12);
	});

	it("returns events grouped into today, thisWeek, nextWeek", async () => {
		let todayEvent = makeEvent({ uid: "today", summary: "Soccer Practice" });
		let weekEvent = makeEvent({ uid: "week", summary: "Dentist" });
		let nextEvent = makeEvent({ uid: "next", summary: "Belt Test" });

		let calendar = createMockCalendar();
		vi.mocked(calendar.fetchEvents)
			.mockResolvedValueOnce([todayEvent])
			.mockResolvedValueOnce([weekEvent])
			.mockResolvedValueOnce([nextEvent]);

		let result = await fetchUpcomingEvents({ calendar }, dateCtx);

		expect(result.today).toEqual([todayEvent]);
		expect(result.thisWeek).toEqual([weekEvent]);
		expect(result.nextWeek).toEqual([nextEvent]);
	});

	it("returns empty arrays when calendar has no events", async () => {
		let calendar = createMockCalendar();
		let result = await fetchUpcomingEvents({ calendar }, dateCtx);

		expect(result.today).toEqual([]);
		expect(result.thisWeek).toEqual([]);
		expect(result.nextWeek).toEqual([]);
	});
});
