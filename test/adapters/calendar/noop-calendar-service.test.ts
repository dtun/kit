import { NoOpCalendarService } from "@adapters/calendar/noop-calendar-service";
import { describe, expect, it } from "vitest";

describe("NoOpCalendarService", () => {
	let service = new NoOpCalendarService();

	it("listCalendars returns empty array", async () => {
		expect(await service.listCalendars()).toEqual([]);
	});

	it("fetchEvents returns empty array", async () => {
		let events = await service.fetchEvents({
			start: new Date(),
			end: new Date(),
		});
		expect(events).toEqual([]);
	});

	it("createEvent rejects with calendar not configured", async () => {
		await expect(
			service.createEvent({ summary: "Test", startDate: "2026-04-09T10:00:00Z" }),
		).rejects.toThrow("Calendar not configured");
	});

	it("updateEvent rejects with calendar not configured", async () => {
		await expect(service.updateEvent("uid", {})).rejects.toThrow(
			"Calendar not configured",
		);
	});

	it("deleteEvent rejects with calendar not configured", async () => {
		await expect(service.deleteEvent("uid")).rejects.toThrow("Calendar not configured");
	});
});
