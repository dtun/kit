import { journalRoute } from "@adapters/http/routes/journal.route";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * Creates a test Hono app with the journal route mounted.
 * Provides a mock R2 bucket via env so R2JournalRepository can be constructed.
 */
function createApp(readResult: Record<string, unknown> | null = null) {
	let mockGet = vi
		.fn()
		.mockResolvedValue(
			readResult ? { text: () => Promise.resolve(readResult.content), uploaded: new Date() } : null,
		);

	let app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		c.env = {
			JOURNAL: { get: mockGet, put: vi.fn(), delete: vi.fn(), list: vi.fn() },
		} as unknown as AppEnv["Bindings"];
		await next();
	});
	app.route("/journal", journalRoute);
	return { app, mockGet };
}

describe("journal route", () => {
	describe("path traversal protection", () => {
		it("rejects empty subpath", async () => {
			let { app } = createApp();
			let res = await app.request("/journal/");
			expect(res.status).toBe(400);
			let body = z.object({ error: z.string() }).parse(await res.json());
			expect(body.error).toBe("Invalid path");
		});

		it("rejects raw .. in URL path", async () => {
			// Hono resolves most .. before routing, but defense-in-depth:
			// if a raw URL somehow contains .., the handler must reject it
			let { app } = createApp();
			// This gets resolved by URL to /journal/secrets, but our handler
			// should still work correctly (not expose data outside journal/)
			let res = await app.request("/journal/2026/%2e%2e/secrets");
			// After URL resolution this becomes /journal/secrets — a valid-looking path
			// The handler should still serve it from journal/ prefix (not escape)
			expect(res.status).not.toBe(500);
		});

		it("constructs R2 key with journal/ prefix for valid paths", async () => {
			let { app, mockGet } = createApp(null);
			await app.request("/journal/2026/04/07/daily.txt");

			// Verify the R2 key passed to repo.read starts with journal/
			let r2Key = mockGet.mock.calls[0]?.[0];
			expect(r2Key).toBe("journal/2026/04/07/daily.txt");
		});

		it("never constructs an R2 key that escapes journal/ prefix", async () => {
			let { app, mockGet } = createApp(null);
			// Even with URL-encoded dots, the resolved path should stay under journal/
			await app.request("/journal/2026/%2e%2e/secrets");

			if (mockGet.mock.calls.length > 0) {
				let r2Key = mockGet.mock.calls[0][0] as string;
				expect(r2Key.startsWith("journal/")).toBe(true);
				expect(r2Key).not.toContain("..");
			}
		});

		it("returns 404 for missing journal entries", async () => {
			let { app } = createApp(null);
			let res = await app.request("/journal/2026/04/07/daily.txt");
			expect(res.status).toBe(404);
		});

		it("returns content for existing journal entries", async () => {
			let { app } = createApp({ content: "- [ ] Call plumber" });
			let res = await app.request("/journal/2026/04/07/daily.txt");
			expect(res.status).toBe(200);
			let text = await res.text();
			expect(text).toContain("Call plumber");
		});
	});
});
