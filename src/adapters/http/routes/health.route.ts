import { getHealth } from "@application/use-cases/get-health";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let healthRoute = new Hono<AppEnv>();

healthRoute.get("/", (c) => {
	let health = getHealth();
	return c.json(health);
});
