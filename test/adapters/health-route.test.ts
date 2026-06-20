import { healthRoute } from "@adapters/http/routes/health.route";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

function createApp(env: Partial<AppEnv["Bindings"]> = {}) {
	let app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		c.env = env as AppEnv["Bindings"];
		await next();
	});
	app.route("/health", healthRoute);
	return app;
}

describe("GET /health", () => {
	it("returns 200 with JSON body", async () => {
		let res = await createApp().request("/health");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	it("includes status, name, version, and timestamp", async () => {
		let res = await createApp().request("/health");
		let body = await res.json();
		expect(body).toHaveProperty("status", "ok");
		expect(body).toHaveProperty("name", "Kit");
		expect(body).toHaveProperty("version");
		expect(body).toHaveProperty("timestamp");
	});

	describe("readiness report", () => {
		it("reports familyMembersValid:false when FAMILY_MEMBERS is unset", async () => {
			let res = await createApp({}).request("/health");
			let body = await res.json();
			expect(body).toHaveProperty("familyMembersValid", false);
		});

		it("reports familyMembersValid:false when FAMILY_MEMBERS is invalid", async () => {
			let res = await createApp({ FAMILY_MEMBERS: "not json" }).request("/health");
			let body = await res.json();
			expect(body).toHaveProperty("familyMembersValid", false);
		});

		it("reports familyMembersValid:true when FAMILY_MEMBERS is valid", async () => {
			let raw = JSON.stringify([{ name: "Dad", contact: "dad@example.com", channel: "email" }]);
			let res = await createApp({ FAMILY_MEMBERS: raw }).request("/health");
			let body = await res.json();
			expect(body).toHaveProperty("familyMembersValid", true);
		});

		it("reports calendarConfigured:false when iCloud creds are missing", async () => {
			let res = await createApp({}).request("/health");
			let body = await res.json();
			expect(body).toHaveProperty("calendarConfigured", false);
		});

		it("reports calendarConfigured:false when only one iCloud cred is set", async () => {
			let res = await createApp({ ICLOUD_APPLE_ID: "user@icloud.com" }).request("/health");
			let body = await res.json();
			expect(body).toHaveProperty("calendarConfigured", false);
		});

		it("reports calendarConfigured:true when both iCloud creds are set", async () => {
			let res = await createApp({
				ICLOUD_APPLE_ID: "user@icloud.com",
				ICLOUD_APP_PASSWORD: "app-pass",
			}).request("/health");
			let body = await res.json();
			expect(body).toHaveProperty("calendarConfigured", true);
		});
	});
});
