import type { AppEnv } from "@infrastructure/env";
import type { MiddlewareHandler } from "hono";

export let authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
	let header = c.req.header("Authorization");
	if (!header) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	let spaceIndex = header.indexOf(" ");
	if (spaceIndex === -1) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	let scheme = header.slice(0, spaceIndex);
	let token = header.slice(spaceIndex + 1).trim();
	if (scheme !== "Bearer" || !token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	if (token !== c.env.API_KEY) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	await next();
};
