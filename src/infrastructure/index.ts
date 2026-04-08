import { createApp } from "@adapters/http/app";
import type { Env } from "./env";

export { KitAgent } from "@adapters/durable-objects/kit-agent";

const app = createApp();

export default {
	fetch: app.fetch,

	async email(message: ForwardableEmailMessage, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Email received but not yet handled");
	},

	async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Scheduled event fired but not yet handled");
	},
};
