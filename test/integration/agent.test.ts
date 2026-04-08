import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("KitAgent (integration)", () => {
	it("responds with ready status via /agent/status", async () => {
		let response = await SELF.fetch("https://kit.dev/agent/status", {
			headers: { Authorization: `Bearer ${(env as { API_KEY: string }).API_KEY}` },
		});
		expect(response.status).toBe(200);
		let body = (await response.json()) as { agent: string; status: string };
		expect(body.agent).toBe("kit");
		expect(body.status).toBe("ready");
	});
});
