import { smsRoute } from "@adapters/http/routes/sms.route";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const FAMILY_MEMBERS = JSON.stringify([
	{ name: "Son", contact: "+14805551234", channel: "sms" },
]);

function createMockDOStub(reply = "Got it!") {
	return {
		fetch: vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ reply }), {
				headers: { "Content-Type": "application/json" },
			}),
		),
	};
}

function createApp(env: Partial<AppEnv["Bindings"]> = {}) {
	const app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		c.env = {
			FAMILY_MEMBERS,
			TWILIO_AUTH_TOKEN: "",
			KIT_AGENT: {
				idFromName: () => "test-id",
				get: () => env.KIT_AGENT?.get?.("test-id") ?? createMockDOStub(),
			},
			...env,
		} as unknown as AppEnv["Bindings"];
		await next();
	});
	app.route("/sms", smsRoute);
	return app;
}

function smsFormBody(params: Record<string, string> = {}) {
	const defaults = {
		From: "+14805551234",
		Body: "Hey Kit!",
		MessageSid: "SM1234567890",
	};
	return new URLSearchParams({ ...defaults, ...params }).toString();
}

describe("SMS webhook route", () => {
	it("returns 200 with TwiML for authorized sender (no signature check in dev)", async () => {
		const stub = createMockDOStub("On it!");
		const app = createApp({
			KIT_AGENT: {
				idFromName: () => "test-id",
				get: () => stub,
			} as unknown as AppEnv["Bindings"]["KIT_AGENT"],
		});

		const res = await app.request("/sms/webhook", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: smsFormBody(),
		});

		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("<Response>");
		expect(text).toContain("<Message>");
		expect(text).toContain("On it!");
	});

	it("returns Content-Type text/xml", async () => {
		const app = createApp();

		const res = await app.request("/sms/webhook", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: smsFormBody(),
		});

		expect(res.headers.get("content-type")).toContain("text/xml");
	});

	it("returns 403 for unauthorized phone number", async () => {
		const app = createApp();

		const res = await app.request("/sms/webhook", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: smsFormBody({ From: "+19995559999" }),
		});

		expect(res.status).toBe(403);
	});

	it("returns 403 when Twilio signature is invalid", async () => {
		const app = createApp({
			TWILIO_AUTH_TOKEN: "real-token",
		} as unknown as Partial<AppEnv["Bindings"]>);

		const res = await app.request("/sms/webhook", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"X-Twilio-Signature": "bad-signature",
			},
			body: smsFormBody(),
		});

		expect(res.status).toBe(403);
	});

	it("escapes XML special characters in TwiML reply", async () => {
		const stub = createMockDOStub("Tom & Jerry <3");
		const app = createApp({
			KIT_AGENT: {
				idFromName: () => "test-id",
				get: () => stub,
			} as unknown as AppEnv["Bindings"]["KIT_AGENT"],
		});

		const res = await app.request("/sms/webhook", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: smsFormBody(),
		});

		const text = await res.text();
		expect(text).toContain("Tom &amp; Jerry &lt;3");
	});
});
