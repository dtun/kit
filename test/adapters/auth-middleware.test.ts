import { authMiddleware } from "@adapters/http/middleware/auth";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

const TEST_API_KEY = "test-secret-key-123";

function createApp() {
	const app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		c.env = { API_KEY: TEST_API_KEY } as unknown as AppEnv["Bindings"];
		await next();
	});
	app.use("*", authMiddleware);
	app.get("/protected", (c) => c.text("ok"));
	return app;
}

describe("authMiddleware", () => {
	describe("missing credentials", () => {
		it("returns 401 when Authorization header is absent", async () => {
			const app = createApp();
			const res = await app.request("/protected");
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body).toEqual({ error: "Unauthorized" });
		});

		it("returns 401 when Authorization header is empty string", async () => {
			const app = createApp();
			const res = await app.request("/protected", {
				headers: { Authorization: "" },
			});
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body).toEqual({ error: "Unauthorized" });
		});
	});

	describe("invalid credentials", () => {
		it("returns 401 when scheme is not Bearer", async () => {
			const app = createApp();
			const res = await app.request("/protected", {
				headers: { Authorization: "Basic dXNlcjpwYXNz" },
			});
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body).toEqual({ error: "Unauthorized" });
		});

		it("returns 401 when token does not match API_KEY", async () => {
			const app = createApp();
			const res = await app.request("/protected", {
				headers: { Authorization: "Bearer wrong-key" },
			});
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body).toEqual({ error: "Unauthorized" });
		});
	});

	describe("valid credentials", () => {
		it("returns 200 and calls through when token matches", async () => {
			const app = createApp();
			const res = await app.request("/protected", {
				headers: { Authorization: `Bearer ${TEST_API_KEY}` },
			});
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("ok");
		});

		it("works with extra whitespace around Bearer token", async () => {
			const app = createApp();
			const res = await app.request("/protected", {
				headers: { Authorization: `Bearer  ${TEST_API_KEY} ` },
			});
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("ok");
		});
	});
});
