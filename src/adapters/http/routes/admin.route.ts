import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let adminRoute = new Hono<AppEnv>();

adminRoute.post("/morning-routine", async (c) => {
	let id = c.env.KIT_AGENT.idFromName("household");
	let agent = c.env.KIT_AGENT.get(id);

	let response = await agent.fetch(
		new Request("https://agent/scheduled", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ cron: "manual", scheduledTime: Date.now() }),
		}),
	);

	let result = await response.json();
	return c.json(result);
});
