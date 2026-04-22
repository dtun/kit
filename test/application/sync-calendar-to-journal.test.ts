import type { ICalendarService } from "@application/ports/calendar-service";
import { syncCalendarToJournal } from "@application/use-cases/sync-calendar-to-journal";
import type { CalendarEvent } from "@domain/entities/calendar-event";
import { createDateContext } from "@domain/entities/date-context";
import { createJournalPaths } from "@domain/entities/journal-path";
import { describe, expect, it, vi } from "vitest";
import { InMemoryJournalRepository } from "../helpers/mocks";

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

describe("syncCalendarToJournal", () => {
	let paths = createJournalPaths("journal/");
	let dateCtx = createDateContext(new Date(2026, 3, 9, 7, 0, 0));

	it("returns empty array and does not touch journal when calendar is empty", async () => {
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		let calendar = createMockCalendar([]);

		let records = await syncCalendarToJournal({ calendar, journal, paths }, dateCtx);

		expect(records).toEqual([]);
		let log = await journal.read(paths.dailyLog(2026, 4, 9));
		expect(log?.content).toBe("# Wednesday\n");
	});

	it("writes a ## Calendar section for an all-day event", async () => {
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		let calendar = createMockCalendar([
			makeEvent({ summary: "Belt Test", allDay: true, startDate: "2026-04-09" }),
		]);

		let records = await syncCalendarToJournal({ calendar, journal, paths }, dateCtx);

		expect(records).toHaveLength(1);
		let log = await journal.read(paths.dailyLog(2026, 4, 9));
		expect(log?.content).toContain("## Calendar");
		expect(log?.content).toContain("- [o] Belt Test (all day)");
	});

	it("formats timed events with time and location", async () => {
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		let calendar = createMockCalendar([
			makeEvent({
				summary: "Soccer Practice",
				startDate: "2026-04-09T23:00:00Z",
				location: "Mesa Sports Complex",
			}),
		]);

		await syncCalendarToJournal({ calendar, journal, paths }, dateCtx);

		let log = await journal.read(paths.dailyLog(2026, 4, 9));
		expect(log?.content).toContain("Soccer Practice");
		expect(log?.content).toContain("@ Mesa Sports Complex");
	});

	it("is idempotent — calling twice produces a single ## Calendar section", async () => {
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		let calendar = createMockCalendar([makeEvent({ summary: "Soccer" })]);

		await syncCalendarToJournal({ calendar, journal, paths }, dateCtx);
		await syncCalendarToJournal({ calendar, journal, paths }, dateCtx);

		let log = await journal.read(paths.dailyLog(2026, 4, 9));
		let calendarHeadings = (log?.content || "").split("## Calendar").length - 1;
		expect(calendarHeadings).toBe(1);
	});

	it("propagates errors from calendar.fetchEvents", async () => {
		let journal = new InMemoryJournalRepository();
		await journal.write(paths.dailyLog(2026, 4, 9), "# Wednesday\n", "seed");
		let calendar = createMockCalendar();
		vi.mocked(calendar.fetchEvents).mockRejectedValue(new Error("CalDAV timeout"));

		await expect(
			syncCalendarToJournal({ calendar, journal, paths }, dateCtx),
		).rejects.toThrow("CalDAV timeout");
	});
});
