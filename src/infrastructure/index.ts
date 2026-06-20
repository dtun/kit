import { createApp } from "@adapters/http/app";
import { parseFamilyMembersSafe } from "@config";
import { authorizeSender } from "@domain/entities/authorization";
import type { Env } from "./env";

export { KitAgent } from "@adapters/durable-objects/kit-agent";

let app = createApp();

export default {
	fetch: app.fetch,

	async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
		// Quick auth check before forwarding to agent
		let result = parseFamilyMembersSafe(env.FAMILY_MEMBERS);
		if (!result.ok) {
			console.error("EMAIL_CONFIG_INVALID", result.error);
			message.setReject("Configuration error");
			return;
		}
		let auth = authorizeSender(message.from, result.members);
		if (!auth.authorized) {
			message.setReject("Not authorized");
			return;
		}

		// Collect raw email bytes
		let rawEmail = await streamToArrayBuffer(message.raw);

		// Forward to Kit agent Durable Object
		let agentId = env.KIT_AGENT.idFromName("household");
		let agent = env.KIT_AGENT.get(agentId);

		let response = await agent.fetch(
			new Request("https://agent/email", {
				method: "POST",
				headers: {
					"Content-Type": "application/octet-stream",
					"X-Email-From": message.from,
					"X-Email-To": message.to,
				},
				body: rawEmail,
			}),
		);

		// Surface failures that were previously discarded: a non-OK status is a
		// processing error, and { replied: false } means we understood the
		// message but couldn't deliver the reply.
		if (!response.ok) {
			console.error("EMAIL_DO_FAILED", response.status);
		} else {
			let result = (await response.json().catch(() => null)) as { replied?: boolean } | null;
			if (result && result.replied === false) {
				console.error("EMAIL_DO_FAILED", "reply-not-sent");
			}
		}
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		let agentId = env.KIT_AGENT.idFromName("household");
		let agent = env.KIT_AGENT.get(agentId);

		let response = await agent.fetch(
			new Request("https://agent/scheduled", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cron: event.cron, scheduledTime: event.scheduledTime }),
			}),
		);

		let result = await response.json();
		console.log("Morning routine result:", JSON.stringify(result));
	},
};

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
	let reader = stream.getReader();
	let chunks: Uint8Array[] = [];
	for (;;) {
		let { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	let total = chunks.reduce((acc, c) => acc + c.length, 0);
	let result = new Uint8Array(total);
	let offset = 0;
	for (let chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result.buffer;
}
