import type { ICalendarService } from "@application/ports/calendar-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { DateContext } from "@domain/entities/date-context";
import type { EditRecord } from "@domain/entities/edit-record";
import type { JournalPaths } from "@domain/entities/journal-path";

export interface SyncCalendarToJournalDeps {
	calendar: ICalendarService;
	journal: IJournalRepository;
	paths: JournalPaths;
}

export async function syncCalendarToJournal(
	deps: SyncCalendarToJournalDeps,
	dateCtx: DateContext,
): Promise<EditRecord[]> {
	let { calendar, journal, paths } = deps;

	let todayStart = new Date(dateCtx.year, dateCtx.month - 1, dateCtx.day);
	let todayEnd = new Date(todayStart);
	todayEnd.setDate(todayEnd.getDate() + 1);

	let events = await calendar.fetchEvents({ start: todayStart, end: todayEnd });

	if (events.length === 0) return [];

	let calendarSection = "\n## Calendar\n";
	for (let event of events) {
		let time = event.allDay
			? "all day"
			: new Date(event.startDate).toLocaleTimeString("en-US", {
					hour: "numeric",
					minute: "2-digit",
				});
		let locationStr = event.location ? ` @ ${event.location}` : "";
		calendarSection += `- [o] ${event.summary} (${time})${locationStr}\n`;
	}

	let dailyPath = paths.dailyLog(dateCtx.year, dateCtx.month, dateCtx.day);
	let existing = await journal.read(dailyPath);

	if (existing && existing.content.includes("## Calendar")) {
		let stripped = existing.content.replace(/\n## Calendar\n(?:- \[o\] [^\n]*\n)*/g, "");
		await journal.write(stripped ? dailyPath : dailyPath, stripped, "Strip old calendar section");
	}

	let record = await journal.append(
		dailyPath,
		calendarSection,
		`Synced ${events.length} calendar event(s) for today`,
	);

	return [record];
}
