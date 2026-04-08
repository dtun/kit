import { createApp } from "@adapters/http/app";
import { FAMILY_MEMBERS } from "@config";
import { authorizeSender } from "@domain/entities/authorization";
import type { Env } from "./env";

export { KitAgent } from "@adapters/durable-objects/kit-agent";

const app = createApp();

export default {
	fetch: app.fetch,

	async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
		// Quick auth check before forwarding to agent
		const auth = authorizeSender(message.from, FAMILY_MEMBERS);
		if (!auth.authorized) {
			message.setReject("Not authorized");
			return;
		}

		// Collect raw email bytes
		const rawEmail = await streamToArrayBuffer(message.raw);

		// Forward to Kit agent Durable Object
		const agentId = env.KIT_AGENT.idFromName("household");
		const agent = env.KIT_AGENT.get(agentId);

		await agent.fetch(
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
	},

	async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
		console.log("Scheduled event fired but not yet handled");
	},
};

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	const total = chunks.reduce((acc, c) => acc + c.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result.buffer;
}
