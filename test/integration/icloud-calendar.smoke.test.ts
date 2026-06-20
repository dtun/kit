import { describe, expect, it } from "vitest";
// Relative import: tsconfig.json excludes test/integration from the project,
// so the @adapters/* path alias is not resolved here.
import { ICloudCalendarService } from "../../src/adapters/calendar/icloud-calendar-service";

// Live smoke test against the real iCloud CalDAV server. It needs real
// credentials, so it is SKIPPED automatically unless both env vars are set.
// Normal CI has no credentials, so this never runs there. To run it locally:
//   ICLOUD_APPLE_ID=you@icloud.com \
//   ICLOUD_APP_PASSWORD=app-specific-password \
//   npm run test:integration
//
// ICLOUD_APP_PASSWORD must be an app-specific password from appleid.apple.com —
// the normal Apple account password will not authenticate.
let appleId = process.env.ICLOUD_APPLE_ID;
let appPassword = process.env.ICLOUD_APP_PASSWORD;

describe.skipIf(!appleId || !appPassword)("ICloudCalendarService (live smoke)", () => {
	it("authenticates and lists calendars", async () => {
		let service = new ICloudCalendarService(appleId as string, appPassword as string);

		let calendars = await service.listCalendars();

		expect(Array.isArray(calendars)).toBe(true);
		for (let calendar of calendars) {
			expect(typeof calendar.name).toBe("string");
			expect(typeof calendar.id).toBe("string");
		}
	});

	it("fetches events for the next 7 days without throwing", async () => {
		let service = new ICloudCalendarService(appleId as string, appPassword as string);

		let now = new Date();
		let weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		let events = await service.fetchEvents({ start: now, end: weekOut });

		expect(Array.isArray(events)).toBe(true);
	});
});
