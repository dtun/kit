import { getHealth } from "@application/use-cases/get-health";
import { AI_MODEL, ANTHROPIC_MODEL, parseFamilyMembersSafe } from "@config";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let healthRoute = new Hono<AppEnv>();

healthRoute.get("/", (c) => {
	let health = getHealth();
	let familyMembersValid = parseFamilyMembersSafe(c.env.FAMILY_MEMBERS).ok;
	let calendarConfigured = Boolean(c.env.ICLOUD_APPLE_ID && c.env.ICLOUD_APP_PASSWORD);
	// Presence only — the key itself (and any prefix of it) never leaves the
	// worker. aiBrainModel names the model digests/replies will actually use:
	// Claude when the key is set, else the Workers AI fallback.
	let aiBrainConfigured = Boolean(c.env.ANTHROPIC_API_KEY);
	let aiBrainModel = aiBrainConfigured ? ANTHROPIC_MODEL : AI_MODEL;
	return c.json({
		...health,
		familyMembersValid,
		calendarConfigured,
		aiBrainConfigured,
		aiBrainModel,
	});
});
