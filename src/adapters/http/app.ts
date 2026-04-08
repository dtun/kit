import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth";
import { adminRoute } from "./routes/admin.route";
import { agentRoute } from "./routes/agent.route";
import { healthRoute } from "./routes/health.route";
import { journalRoute } from "./routes/journal.route";
import { smsRoute } from "./routes/sms.route";

export function createApp() {
	let app = new Hono<AppEnv>();

	app.use("*", logger());

	app.route("/health", healthRoute);
	app.route("/sms", smsRoute);

	app.use("/journal/*", authMiddleware);
	app.use("/agent/*", authMiddleware);
	app.use("/admin/*", authMiddleware);
	app.route("/agent", agentRoute);
	app.route("/journal", journalRoute);
	app.route("/admin", adminRoute);

	app.all("*", (c) => c.text("Kit is alive.", 200));

	return app;
}
