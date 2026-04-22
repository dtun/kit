import type { ICalendarService } from "@application/ports/calendar-service";
import type { CalendarEvent } from "@domain/entities/calendar-event";
import type { DateContext } from "@domain/entities/date-context";

export interface FetchUpcomingEventsDeps {
	calendar: ICalendarService;
}

export interface UpcomingEvents {
	readonly today: CalendarEvent[];
	readonly thisWeek: CalendarEvent[];
	readonly nextWeek: CalendarEvent[];
}

export async function fetchUpcomingEvents(
	deps: FetchUpcomingEventsDeps,
	dateCtx: DateContext,
): Promise<UpcomingEvents> {
	let { calendar } = deps;
	let now = dateCtx.now;

	let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let todayEnd = new Date(todayStart);
	todayEnd.setDate(todayEnd.getDate() + 1);

	let weekEnd = new Date(todayStart);
	weekEnd.setDate(weekEnd.getDate() + dateCtx.daysLeftInWeek + 1);

	let nextWeekStart = new Date(weekEnd);
	let nextWeekEnd = new Date(nextWeekStart);
	nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

	let [today, thisWeek, nextWeek] = await Promise.all([
		calendar.fetchEvents({ start: todayStart, end: todayEnd }),
		calendar.fetchEvents({ start: todayEnd, end: weekEnd }),
		calendar.fetchEvents({ start: nextWeekStart, end: nextWeekEnd }),
	]);

	return { today, thisWeek, nextWeek };
}
