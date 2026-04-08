import { adminRoute } from "@adapters/http/routes/admin.route";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

function createApp(mockRoutineResult: Record<string, unknown> = {}) {
	const app = new Hono<AppEnv>();

	const defaultResult = {
		dailyLogCreated: true,
		tasksMigrated: 1,
		entriesArchived: 0,
		digestsSent: ["Danny"],
		monthRolled: false,
		errors: [],
		...mockRoutineResult,
	};

	app.use("*", async (c, next) => {
		c.env = {
			KIT_AGENT: {
				idFromName: vi.fn().mockReturnValue("mock-id"),
				get: vi.fn().mockReturnValue({
					fetch: vi.fn().mockResolvedValue(
						new Response(JSON.stringify(defaultResult), {
							headers: { "Content-Type": "application/json" },
						}),
					),
				}),
			},
		} as unknown as AppEnv["Bindings"];
		await next();
	});

	app.route("/admin", adminRoute);
	return app;
}

describe("POST /admin/morning-routine", () => {
	it("returns 200 with MorningRoutineResult JSON", async () => {
		const app = createApp();
		const res = await app.request("/admin/morning-routine", { method: "POST" });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");

		const body = await res.json();
		expect(body).toHaveProperty("dailyLogCreated", true);
		expect(body).toHaveProperty("tasksMigrated", 1);
		expect(body).toHaveProperty("digestsSent");
	});

	it("forwards to the KitAgent Durable Object", async () => {
		const mockFetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ dailyLogCreated: true }), {
				headers: { "Content-Type": "application/json" },
			}),
		);
		const mockGet = vi.fn().mockReturnValue({ fetch: mockFetch });
		const mockIdFromName = vi.fn().mockReturnValue("household-id");

		const app = new Hono<AppEnv>();
		app.use("*", async (c, next) => {
			c.env = {
				KIT_AGENT: { idFromName: mockIdFromName, get: mockGet },
			} as unknown as AppEnv["Bindings"];
			await next();
		});
		app.route("/admin", adminRoute);

		await app.request("/admin/morning-routine", { method: "POST" });

		expect(mockIdFromName).toHaveBeenCalledWith("household");
		expect(mockGet).toHaveBeenCalledWith("household-id");
		expect(mockFetch).toHaveBeenCalled();
	});
});
