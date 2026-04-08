import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let agentRoute = new Hono<AppEnv>();

agentRoute.all("/status", async (c) => {
	let id = c.env.KIT_AGENT.idFromName("household");
	let stub = c.env.KIT_AGENT.get(id);
	return stub.fetch(c.req.raw);
});
