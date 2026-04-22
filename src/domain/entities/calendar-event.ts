export interface CalendarEvent {
	readonly uid: string;
	readonly summary: string;
	readonly description?: string;
	readonly location?: string;
	readonly startDate: string;
	readonly endDate: string;
	readonly allDay: boolean;
	readonly recurring: boolean;
	readonly calendarName: string;
	readonly attendees?: string[];
	readonly reminders?: number[];
}

export interface CalendarQuery {
	readonly start: Date;
	readonly end: Date;
	readonly calendarNames?: string[];
}

export interface CalendarCreateRequest {
	readonly summary: string;
	readonly startDate: string;
	readonly endDate?: string;
	readonly allDay?: boolean;
	readonly location?: string;
	readonly description?: string;
	readonly calendarName?: string;
	readonly reminders?: number[];
}
