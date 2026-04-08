import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export const agentRoute = new Hono<AppEnv>();

agentRoute.all("/status", async (c) => {
	const id = c.env.KIT_AGENT.idFromName("household");
	const stub = c.env.KIT_AGENT.get(id);
	return stub.fetch(c.req.raw);
});
