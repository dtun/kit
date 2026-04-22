import type { ICalendarService } from "@application/ports/calendar-service";
import { createCalendarEvent } from "@application/use-cases/create-calendar-event";
import type { CalendarEvent } from "@domain/entities/calendar-event";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it, vi } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

function createMockCalendar(returnEvent: CalendarEvent): ICalendarService {
	return {
		listCalendars: vi.fn().mockResolvedValue([]),
		fetchEvents: vi.fn().mockResolvedValue([]),
		createEvent: vi.fn().mockResolvedValue(returnEvent),
		updateEvent: vi.fn(),
		deleteEvent: vi.fn(),
	};
}

describe("createCalendarEvent", () => {
	let paths = createJournalPaths("journal/");

	it("creates event on calendar and logs to today's daily log", async () => {
		let now = new Date(2026, 3, 9, 10, 0, 0);
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");

		let event: CalendarEvent = {
			uid: "new-123",
			summary: "Dentist",
			startDate: "2026-04-10T15:00:00Z",
			endDate: "2026-04-10T16:00:00Z",
			allDay: false,
			recurring: false,
			calendarName: "Family",
		};
		let calendar = createMockCalendar(event);

		let result = await createCalendarEvent(
			{ calendar, journal, paths },
			{ summary: "Dentist", startDate: "2026-04-10T15:00:00Z" },
			now,
		);

		expect(result.event.summary).toBe("Dentist");
		expect(calendar.createEvent).toHaveBeenCalledOnce();

		let todayLog = await journal.read(paths.dailyLog(2026, 4, 9));
		expect(todayLog?.content).toContain("Dentist");
		expect(todayLog?.content).toContain("Added to calendar");
	});

	it("appends to future log when event is in the future", async () => {
		let now = new Date(2026, 3, 9, 10, 0, 0);
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		await journal.write(paths.futureLog(), "# Future\n", "seed");

		let event: CalendarEvent = {
			uid: "future-1",
			summary: "Belt Test",
			startDate: "2026-04-18T00:00:00Z",
			endDate: "2026-04-18T23:59:59Z",
			allDay: true,
			recurring: false,
			calendarName: "Family",
		};
		let calendar = createMockCalendar(event);

		await createCalendarEvent(
			{ calendar, journal, paths },
			{ summary: "Belt Test", startDate: "2026-04-18T00:00:00Z", allDay: true },
			now,
		);

		let futureLog = await journal.read(paths.futureLog());
		expect(futureLog?.content).toContain("Belt Test");
	});

	it("does not touch future log when event is today or in the past", async () => {
		let now = new Date(2026, 3, 9, 14, 0, 0);
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		await journal.write(paths.futureLog(), "# Future\n", "seed");

		let event: CalendarEvent = {
			uid: "past-1",
			summary: "Lunch",
			startDate: "2026-04-09T12:00:00Z",
			endDate: "2026-04-09T13:00:00Z",
			allDay: false,
			recurring: false,
			calendarName: "Family",
		};
		let calendar = createMockCalendar(event);

		await createCalendarEvent(
			{ calendar, journal, paths },
			{ summary: "Lunch", startDate: "2026-04-09T12:00:00Z" },
			now,
		);

		let futureLog = await journal.read(paths.futureLog());
		expect(futureLog?.content).toBe("# Future\n");
	});
});
