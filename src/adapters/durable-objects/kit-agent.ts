import { DurableObject } from "cloudflare:workers";
import type { Env } from "@infrastructure/env";

export class KitAgent extends DurableObject<Env> {
	async fetch(_request: Request): Promise<Response> {
		return new Response(
			JSON.stringify({
				agent: "kit",
				status: "ready",
				timestamp: new Date().toISOString(),
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	}
}
