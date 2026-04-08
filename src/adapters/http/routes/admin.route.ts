import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export const adminRoute = new Hono<AppEnv>();

adminRoute.post("/morning-routine", async (c) => {
	const id = c.env.KIT_AGENT.idFromName("household");
	const agent = c.env.KIT_AGENT.get(id);

	const response = await agent.fetch(
		new Request("https://agent/scheduled", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ cron: "manual", scheduledTime: Date.now() }),
		}),
	);

	const result = await response.json();
	return c.json(result);
});
