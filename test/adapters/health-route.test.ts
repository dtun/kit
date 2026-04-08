import { healthRoute } from "@adapters/http/routes/health.route";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

const app = new Hono<AppEnv>();
app.route("/health", healthRoute);

describe("GET /health", () => {
	it("returns 200 with JSON body", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	it("includes status, name, version, and timestamp", async () => {
		const res = await app.request("/health");
		const body = await res.json();
		expect(body).toHaveProperty("status", "ok");
		expect(body).toHaveProperty("name", "Kit");
		expect(body).toHaveProperty("version");
		expect(body).toHaveProperty("timestamp");
	});
});
