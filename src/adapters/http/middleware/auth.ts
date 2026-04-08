import type { AppEnv } from "@infrastructure/env";
import type { MiddlewareHandler } from "hono";

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
	const header = c.req.header("Authorization");
	if (!header) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const spaceIndex = header.indexOf(" ");
	if (spaceIndex === -1) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const scheme = header.slice(0, spaceIndex);
	const token = header.slice(spaceIndex + 1).trim();
	if (scheme !== "Bearer" || !token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	if (token !== c.env.API_KEY) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	await next();
};
