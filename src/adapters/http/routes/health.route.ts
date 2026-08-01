import { getHealth } from "@application/use-cases/get-health";
import { AI_MODEL, ANTHROPIC_MODEL, parseFamilyMembersSafe } from "@config";
import type { CronRun } from "@domain/entities/cron-run";
import type { AppEnv, Env } from "@infrastructure/env";
import { Hono } from "hono";

export let healthRoute = new Hono<AppEnv>();

healthRoute.get("/", async (c) => {
	let health = getHealth();
	let familyMembersValid = parseFamilyMembersSafe(c.env.FAMILY_MEMBERS).ok;
	let calendarConfigured = Boolean(c.env.ICLOUD_APPLE_ID && c.env.ICLOUD_APP_PASSWORD);
	// Presence only — the key itself (and any prefix of it) never leaves the
	// worker. aiBrainModel names the model digests/replies will actually use:
	// Claude when the key is set, else the Workers AI fallback.
	let aiBrainConfigured = Boolean(c.env.ANTHROPIC_API_KEY);
	let aiBrainModel = aiBrainConfigured ? ANTHROPIC_MODEL : AI_MODEL;
	let lastCron = await readLastCron(c.env);
	return c.json({
		...health,
		familyMembersValid,
		calendarConfigured,
		aiBrainConfigured,
		aiBrainModel,
		lastCron,
	});
});

/**
 * The cron outcome lives in the KitAgent Durable Object's SQLite, so /health
 * has to ask the agent for it. Health must never fail because of this read:
 * an unreachable agent reports null, same as a cron that has never run.
 */
async function readLastCron(env: Env): Promise<CronRun | null> {
	if (!env.KIT_AGENT) return null;

	try {
		let stub = env.KIT_AGENT.get(env.KIT_AGENT.idFromName("household"));
		let res = await stub.fetch("https://agent/last-cron");
		if (!res.ok) return null;
		let body = (await res.json()) as { lastCron?: CronRun | null };
		return body.lastCron ?? null;
	} catch (err) {
		console.error("HEALTH_LAST_CRON_UNAVAILABLE", err);
		return null;
	}
}
