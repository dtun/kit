import type {
	CalendarEvent,
	CalendarQuery,
	CalendarCreateRequest,
} from "@domain/entities/calendar-event";

export interface ICalendarService {
	listCalendars(): Promise<{ name: string; id: string; readOnly: boolean }[]>;
	fetchEvents(query: CalendarQuery): Promise<CalendarEvent[]>;
	createEvent(request: CalendarCreateRequest): Promise<CalendarEvent>;
	updateEvent(uid: string, updates: Partial<CalendarCreateRequest>): Promise<CalendarEvent>;
	deleteEvent(uid: string): Promise<void>;
}
