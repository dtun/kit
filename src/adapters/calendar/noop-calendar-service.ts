import type { ICalendarService } from "@application/ports/calendar-service";
import type {
	CalendarEvent,
	CalendarQuery,
	CalendarCreateRequest,
} from "@domain/entities/calendar-event";

export class NoOpCalendarService implements ICalendarService {
	async listCalendars(): Promise<{ name: string; id: string; readOnly: boolean }[]> {
		return [];
	}

	async fetchEvents(_query: CalendarQuery): Promise<CalendarEvent[]> {
		return [];
	}

	async createEvent(_request: CalendarCreateRequest): Promise<CalendarEvent> {
		throw new Error("Calendar not configured");
	}

	async updateEvent(
		_uid: string,
		_updates: Partial<CalendarCreateRequest>,
	): Promise<CalendarEvent> {
		throw new Error("Calendar not configured");
	}

	async deleteEvent(_uid: string): Promise<void> {
		throw new Error("Calendar not configured");
	}
}
