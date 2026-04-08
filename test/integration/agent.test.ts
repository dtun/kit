import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("KitAgent (integration)", () => {
	it("responds with ready status via /agent/status", async () => {
		const response = await SELF.fetch("https://kit.dev/agent/status");
		expect(response.status).toBe(200);
		const body = (await response.json()) as { agent: string; status: string };
		expect(body.agent).toBe("kit");
		expect(body.status).toBe("ready");
	});
});
