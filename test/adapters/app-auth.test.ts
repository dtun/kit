import { createApp } from "@adapters/http/app";
import type { Env } from "@infrastructure/env";
import { describe, expect, it, vi } from "vitest";

let TEST_API_KEY = "test-secret-key-456";

let mockEnv: Env = {
	API_KEY: TEST_API_KEY,
	JOURNAL: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
	KIT_AGENT: {
		idFromName: vi.fn().mockReturnValue("id"),
		get: vi.fn().mockReturnValue({
			fetch: vi.fn().mockResolvedValue(new Response("ok")),
		}),
	},
} as unknown as Env;

describe("app auth wiring", () => {
	it("GET /health returns 200 without auth header", async () => {
		let app = createApp();
		let res = await app.request("/health", {}, mockEnv);
		expect(res.status).toBe(200);
	});

	it("GET /journal/2026/04/07/daily.txt returns 401 without auth header", async () => {
		let app = createApp();
		let res = await app.request("/journal/2026/04/07/daily.txt", {}, mockEnv);
		expect(res.status).toBe(401);
		let body = await res.json();
		expect(body).toEqual({ error: "Unauthorized" });
	});

	it("GET /agent/status returns 401 without auth header", async () => {
		let app = createApp();
		let res = await app.request("/agent/status", {}, mockEnv);
		expect(res.status).toBe(401);
		let body = await res.json();
		expect(body).toEqual({ error: "Unauthorized" });
	});
});
