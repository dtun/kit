import { createDAVClient, type DAVCalendar } from "tsdav";
import type { ICalendarService } from "@application/ports/calendar-service";
import type {
	CalendarEvent,
	CalendarQuery,
	CalendarCreateRequest,
} from "@domain/entities/calendar-event";

// tsdav's DAVClient type has mismatches between overload signatures and the
// object returned by createDAVClient. We use a loose interface for the subset
// of methods Kit actually calls.
interface DAVClientLike {
	fetchCalendars(): Promise<DAVCalendar[]>;
	fetchCalendarObjects(params: {
		calendar: DAVCalendar;
		timeRange: { start: string; end: string };
	}): Promise<{ data: string | Record<string, unknown>; url: string; etag: string }[]>;
	createCalendarObject(params: {
		calendar: DAVCalendar;
		filename: string;
		iCalString: string;
	}): Promise<unknown>;
}

export class ICloudCalendarService implements ICalendarService {
	private client: DAVClientLike | null = null;
	private calendars: DAVCalendar[] = [];
	private appleId: string;
	private appPassword: string;

	constructor(appleId: string, appPassword: string) {
		this.appleId = appleId;
		this.appPassword = appPassword;
	}

	private async getClient(): Promise<DAVClientLike> {
		if (this.client) return this.client;

		let client = (await createDAVClient({
			serverUrl: "https://caldav.icloud.com",
			credentials: {
				username: this.appleId,
				password: this.appPassword,
			},
			authMethod: "Basic",
			defaultAccountType: "caldav",
		})) as unknown as DAVClientLike;

		this.calendars = await client.fetchCalendars();
		this.client = client;
		return client;
	}

	async listCalendars(): Promise<{ name: string; id: string; readOnly: boolean }[]> {
		await this.getClient();
		return this.calendars.map((cal) => ({
			name: (cal.displayName as string) || "Unnamed",
			id: cal.url,
			readOnly: false,
		}));
	}

	async fetchEvents(query: CalendarQuery): Promise<CalendarEvent[]> {
		let client = await this.getClient();
		let events: CalendarEvent[] = [];

		let targetCalendars = query.calendarNames
			? this.calendars.filter((c) =>
					query.calendarNames!.some(
						(name) =>
							(c.displayName as string | undefined)?.toLowerCase() ===
							name.toLowerCase(),
					),
				)
			: this.calendars;

		for (let calendar of targetCalendars) {
			let objects = await client.fetchCalendarObjects({
				calendar,
				timeRange: {
					start: query.start.toISOString(),
					end: query.end.toISOString(),
				},
			});

			for (let obj of objects) {
				if (typeof obj.data !== "string") continue;
				let parsed = parseICSToEvent(obj.data, (calendar.displayName as string) || "");
				if (parsed) events.push(parsed);
			}
		}

		events.sort(
			(a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
		);

		return events;
	}

	async createEvent(request: CalendarCreateRequest): Promise<CalendarEvent> {
		let client = await this.getClient();

		let targetCal = request.calendarName
			? this.calendars.find(
					(c) =>
						(c.displayName as string | undefined)?.toLowerCase() ===
						request.calendarName!.toLowerCase(),
				)
			: this.calendars[0];

		if (!targetCal) throw new Error(`Calendar not found: ${request.calendarName}`);

		let uid = crypto.randomUUID();
		let ics = buildICS(uid, request);

		await client.createCalendarObject({
			calendar: targetCal,
			filename: `${uid}.ics`,
			iCalString: ics,
		});

		return {
			uid,
			summary: request.summary,
			description: request.description,
			location: request.location,
			startDate: request.startDate,
			endDate: request.endDate || addHours(request.startDate, 1),
			allDay: request.allDay || false,
			recurring: false,
			calendarName: (targetCal.displayName as string) || "",
		};
	}

	async updateEvent(
		_uid: string,
		_updates: Partial<CalendarCreateRequest>,
	): Promise<CalendarEvent> {
		throw new Error("Not implemented yet — phase 2");
	}

	async deleteEvent(_uid: string): Promise<void> {
		throw new Error("Not implemented yet — phase 2");
	}
}

export function buildICS(uid: string, request: CalendarCreateRequest): string {
	let startDate = new Date(request.startDate);
	let endDate = request.endDate
		? new Date(request.endDate)
		: new Date(startDate.getTime() + 60 * 60 * 1000);

	let dtStart: string;
	let dtEnd: string;

	if (request.allDay) {
		dtStart = `DTSTART;VALUE=DATE:${formatDateOnly(startDate)}`;
		dtEnd = `DTEND;VALUE=DATE:${formatDateOnly(endDate)}`;
	} else {
		dtStart = `DTSTART:${formatDateTime(startDate)}`;
		dtEnd = `DTEND:${formatDateTime(endDate)}`;
	}

	let lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Kit//kitkit.dev//EN",
		"CALSCALE:GREGORIAN",
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${formatDateTime(new Date())}`,
		dtStart,
		dtEnd,
		`SUMMARY:${escapeICS(request.summary)}`,
	];

	if (request.description) {
		lines.push(`DESCRIPTION:${escapeICS(request.description)}`);
	}
	if (request.location) {
		lines.push(`LOCATION:${escapeICS(request.location)}`);
	}
	if (request.reminders) {
		for (let minutes of request.reminders) {
			lines.push(
				"BEGIN:VALARM",
				"ACTION:DISPLAY",
				"DESCRIPTION:Reminder",
				`TRIGGER:-PT${minutes}M`,
				"END:VALARM",
			);
		}
	}

	lines.push("END:VEVENT", "END:VCALENDAR");
	return lines.join("\r\n");
}

export function parseICSToEvent(
	icsData: string,
	calendarName: string,
): CalendarEvent | null {
	let uid = extractICSField(icsData, "UID") || "";
	let summary = extractICSField(icsData, "SUMMARY") || "Untitled";
	let description = extractICSField(icsData, "DESCRIPTION");
	let location = extractICSField(icsData, "LOCATION");
	let dtStart = extractICSField(icsData, "DTSTART");
	let dtEnd = extractICSField(icsData, "DTEND");
	let rrule = extractICSField(icsData, "RRULE");

	if (!dtStart) return null;

	let allDay = icsData.includes("VALUE=DATE") && !icsData.includes("VALUE=DATE-TIME");
	let startDate = parseICSDate(dtStart);
	let endDate = dtEnd ? parseICSDate(dtEnd) : startDate;

	return {
		uid,
		summary,
		description: description || undefined,
		location: location || undefined,
		startDate,
		endDate,
		allDay,
		recurring: !!rrule,
		calendarName,
	};
}

function extractICSField(ics: string, field: string): string | null {
	let regex = new RegExp(`^${field}[;:](.+)$`, "mi");
	let match = ics.match(regex);
	if (!match) return null;
	let value = match[1];
	if (value.includes(":")) {
		value = value.split(":").pop() || value;
	}
	return unescapeICS(value.trim());
}

function parseICSDate(value: string): string {
	let cleaned = value.replace(/[^0-9TZ]/g, "");
	if (cleaned.length === 8) {
		return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
	}
	if (cleaned.length >= 15) {
		return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}Z`;
	}
	return value;
}

function formatDateTime(d: Date): string {
	return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatDateOnly(d: Date): string {
	let y = d.getUTCFullYear();
	let m = String(d.getUTCMonth() + 1).padStart(2, "0");
	let day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}${m}${day}`;
}

function escapeICS(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

function unescapeICS(text: string): string {
	return text
		.replace(/\\n/g, "\n")
		.replace(/\\,/g, ",")
		.replace(/\\;/g, ";")
		.replace(/\\\\/g, "\\");
}

function addHours(isoDate: string, hours: number): string {
	let d = new Date(isoDate);
	d.setHours(d.getHours() + hours);
	return d.toISOString();
}
