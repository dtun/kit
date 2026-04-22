import type { IAIService } from "@application/ports/ai-service";
import type { ICalendarService } from "@application/ports/calendar-service";
import type { IJournalRepository } from "@application/ports/journal-repository";
import type { CalendarEvent } from "@domain/entities/calendar-event";
import type { DateContext } from "@domain/entities/date-context";
import type { JournalPaths } from "@domain/entities/journal-path";
import { KIT_PERSONA } from "@domain/entities/persona";
import { fetchUpcomingEvents } from "./fetch-upcoming-events";

export interface CompileStatusDeps {
	journal: IJournalRepository;
	ai: IAIService;
	paths: JournalPaths;
	coldStartRules?: readonly string[];
	calendar?: ICalendarService;
}

export async function compileStatus(
	deps: CompileStatusDeps,
	dateCtx: DateContext,
	memberName: string,
): Promise<string> {
	let { journal, ai, paths } = deps;
	let { year, month, day } = dateCtx;
	let sections: string[] = [];

	// 1. Today's log
	let todayLog = await journal.read(paths.dailyLog(year, month, day));
	if (todayLog) sections.push(`TODAY (${dateCtx.dayOfWeek}):\n${todayLog.content}`);

	// 2. Rest of this week (look ahead)
	for (let offset = 1; offset <= dateCtx.daysLeftInWeek; offset++) {
		let futureDate = new Date(year, month - 1, day + offset);
		let fy = futureDate.getFullYear();
		let fm = futureDate.getMonth() + 1;
		let fd = futureDate.getDate();
		let futurePath = paths.dailyLog(fy, fm, fd);
		let futureLog = await journal.read(futurePath);
		if (futureLog) {
			let label = futureDate.toLocaleString("en-US", { weekday: "long" });
			sections.push(`${label.toUpperCase()}:\n${futureLog.content}`);
		}
	}

	// 3. Monthly context
	let monthLog = await journal.read(paths.monthlyLog(year, month));
	if (monthLog) sections.push(`MONTHLY OVERVIEW:\n${monthLog.content}`);

	// 4. Future log
	let futureLog = await journal.read(paths.futureLog());
	if (futureLog) sections.push(`FUTURE LOG:\n${futureLog.content}`);

	// 5. Forward-looking calendar events (thisWeek + nextWeek only; today is already in the daily log)
	if (deps.calendar) {
		try {
			let upcoming = await fetchUpcomingEvents({ calendar: deps.calendar }, dateCtx);
			if (upcoming.thisWeek.length > 0) {
				sections.push(
					`THIS WEEK'S CALENDAR:\n${upcoming.thisWeek.map((e) => `- ${formatCalendarLine(e)}`).join("\n")}`,
				);
			}
			if (upcoming.nextWeek.length > 0) {
				sections.push(
					`NEXT WEEK'S CALENDAR:\n${upcoming.nextWeek.map((e) => `- ${formatCalendarLine(e)}`).join("\n")}`,
				);
			}
		} catch {
			// Calendar fetch failed — continue without calendar context
		}
	}

	// 6. Frame instruction based on day
	let frameInstruction = dateCtx.isSunday
		? "This is a SUNDAY status — frame it as a week-ahead preview. What's coming this week?"
		: dateCtx.isMonday
			? "This is a MONDAY status — frame it as a fresh start. What needs attention today?"
			: `This is a ${dateCtx.dayOfWeek} status — focus on today and remaining week.`;

	let journalContext = sections.join("\n\n---\n\n") || "The journal is empty — nothing logged yet.";

	let systemPrompt = [
		`You are ${KIT_PERSONA.name}. ${KIT_PERSONA.traits[0]}.`,
		"",
		frameInstruction,
		"",
		`Compile a status update for ${memberName} based on the journal below.`,
		"Structure: start with today, then upcoming, then anything overdue or noteworthy.",
		"If there are open tasks from previous days, flag them as overdue.",
		"",
		...KIT_PERSONA.rules.map((r) => `- ${r}`),
		...(deps.coldStartRules && deps.coldStartRules.length > 0
			? ["", "COLD START BEHAVIOR:", ...deps.coldStartRules.map((r) => `- ${r}`)]
			: []),
		"",
		"Journal:",
		journalContext,
	].join("\n");

	return ai.complete(systemPrompt, `Give ${memberName} their ${dateCtx.dayOfWeek} status update.`);
}

function formatCalendarLine(event: CalendarEvent): string {
	let day = new Date(event.startDate).toLocaleDateString("en-US", { weekday: "short" });
	let time = event.allDay
		? "all day"
		: new Date(event.startDate).toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
			});
	let loc = event.location ? ` @ ${event.location}` : "";
	return `${day} ${event.summary} (${time})${loc}`;
}
