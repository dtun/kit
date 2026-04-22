import type { ICalendarService } from "@application/ports/calendar-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { CalendarCreateRequest, CalendarEvent } from "@domain/entities/calendar-event";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalPaths } from "@domain/entities/journal-path";

export interface CreateCalendarEventDeps {
	calendar: ICalendarService;
	journal: IJournalRepository;
	paths: JournalPaths;
}

export interface CreateEventResult {
	readonly event: CalendarEvent;
	readonly journalRecord: EditRecord;
}

export async function createCalendarEvent(
	deps: CreateCalendarEventDeps,
	request: CalendarCreateRequest,
	now: Date,
): Promise<CreateEventResult> {
	let { calendar, journal, paths } = deps;

	let event = await calendar.createEvent(request);

	let y = now.getFullYear();
	let m = now.getMonth() + 1;
	let d = now.getDate();
	let dailyPath = paths.dailyLog(y, m, d);

	let eventLine = `- [o] Added to calendar: ${event.summary} (${formatEventDate(event)})\n`;
	let journalRecord = await journal.append(
		dailyPath,
		eventLine,
		`Created calendar event: ${event.summary}`,
	);

	let eventDate = new Date(event.startDate);
	if (eventDate > now) {
		await journal.append(
			paths.futureLog(),
			`\n- [o] ${event.summary} — ${formatEventDate(event)}\n`,
			`Scheduled future event: ${event.summary}`,
		);
	}

	return { event, journalRecord };
}

function formatEventDate(event: CalendarEvent): string {
	let start = new Date(event.startDate);
	if (event.allDay) {
		return start.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	}
	return start.toLocaleString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}
