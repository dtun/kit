import { landingRoute } from "@adapters/http/routes/landing.route";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

let app = new Hono<AppEnv>();
app.route("/", landingRoute);

describe("GET /", () => {
	it("returns 200 status", async () => {
		let res = await app.request("/");
		expect(res.status).toBe(200);
	});

	it("returns Content-Type text/html", async () => {
		let res = await app.request("/");
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("includes the page title", async () => {
		let res = await app.request("/");
		let body = await res.text();
		expect(body).toContain("Kit — Kinetic Intelligence Tool");
	});

	it("includes the privacy section", async () => {
		let res = await app.request("/");
		let body = await res.text();
		expect(body).toContain('id="privacy"');
	});

	it("includes the terms of service section", async () => {
		let res = await app.request("/");
		let body = await res.text();
		expect(body).toContain('id="tos"');
	});
});
