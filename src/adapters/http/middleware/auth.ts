import type { AppEnv } from "@infrastructure/env";
import type { MiddlewareHandler } from "hono";

export const authMiddleware: MiddlewareHandler<AppEnv> = async (_c, next) => {
	// Stub — family member whitelist check will be implemented later
	await next();
};
