import { getHealth } from "@application/use-cases/get-health";
import { parseFamilyMembersSafe } from "@config";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let healthRoute = new Hono<AppEnv>();

healthRoute.get("/", (c) => {
	let health = getHealth();
	let familyMembersValid = parseFamilyMembersSafe(c.env.FAMILY_MEMBERS).ok;
	let calendarConfigured = Boolean(c.env.ICLOUD_APPLE_ID && c.env.ICLOUD_APP_PASSWORD);
	return c.json({ ...health, familyMembersValid, calendarConfigured });
});
