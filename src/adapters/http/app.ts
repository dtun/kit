import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { agentRoute } from "./routes/agent.route";
import { healthRoute } from "./routes/health.route";
import { journalRoute } from "./routes/journal.route";

export function createApp() {
	const app = new Hono<AppEnv>();

	app.use("*", logger());

	app.route("/health", healthRoute);
	app.route("/agent", agentRoute);
	app.route("/journal", journalRoute);

	app.all("*", (c) => c.text("Kit is alive.", 200));

	return app;
}
