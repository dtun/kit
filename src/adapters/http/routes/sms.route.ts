import { validateTwilioSignature } from "@adapters/sms/twilio-validator";
import { parseFamilyMembers } from "@config";
import { authorizeSender } from "@domain/entities/authorization";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export const smsRoute = new Hono<AppEnv>();

smsRoute.post("/webhook", async (c) => {
	const authToken = c.env.TWILIO_AUTH_TOKEN || "";

	const formData = await c.req.parseBody();
	const from = String(formData.From || "");
	const body = String(formData.Body || "");
	const messageSid = String(formData.MessageSid || "");

	// Validate Twilio signature
	const signature = c.req.header("X-Twilio-Signature") || "";
	const url = new URL(c.req.url);
	const fullUrl = `${url.origin}${url.pathname}`;
	const params: Record<string, string> = {};
	for (const [k, v] of Object.entries(formData)) {
		params[k] = String(v);
	}

	const valid = await validateTwilioSignature(authToken, signature, fullUrl, params);
	if (!valid) {
		return c.text("Forbidden", 403);
	}

	// Authorize sender
	const familyMembers = parseFamilyMembers(c.env.FAMILY_MEMBERS);
	const auth = authorizeSender(from, familyMembers);
	if (!auth.authorized) {
		return c.text("Forbidden", 403);
	}

	// Forward to KitAgent DO
	const id = c.env.KIT_AGENT.idFromName("household");
	const stub = c.env.KIT_AGENT.get(id);
	const doResponse = await stub.fetch(
		new Request("https://kit-agent/sms", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from, body, messageSid }),
		}),
	);

	const { reply } = (await doResponse.json()) as { reply: string };

	const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
	return c.body(twiml, 200, { "Content-Type": "text/xml" });
});

function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
