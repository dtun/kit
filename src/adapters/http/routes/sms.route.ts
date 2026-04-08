import { validateTwilioSignature } from "@adapters/sms/twilio-validator";
import { parseFamilyMembers } from "@config";
import { authorizeSender } from "@domain/entities/authorization";
import type { AppEnv } from "@infrastructure/env";
import { Hono } from "hono";

export let smsRoute = new Hono<AppEnv>();

smsRoute.post("/webhook", async (c) => {
	let authToken = c.env.TWILIO_AUTH_TOKEN || "";

	let formData = await c.req.parseBody();
	let from = String(formData.From || "");
	let body = String(formData.Body || "");
	let messageSid = String(formData.MessageSid || "");

	// Validate Twilio signature
	let signature = c.req.header("X-Twilio-Signature") || "";
	let url = new URL(c.req.url);
	let fullUrl = `${url.origin}${url.pathname}`;
	let params: Record<string, string> = {};
	for (let [k, v] of Object.entries(formData)) {
		params[k] = String(v);
	}

	let valid = await validateTwilioSignature(authToken, signature, fullUrl, params);
	if (!valid) {
		return c.text("Forbidden", 403);
	}

	// Authorize sender
	let familyMembers = parseFamilyMembers(c.env.FAMILY_MEMBERS);
	let auth = authorizeSender(from, familyMembers);
	if (!auth.authorized) {
		return c.text("Forbidden", 403);
	}

	// Forward to KitAgent DO
	let id = c.env.KIT_AGENT.idFromName("household");
	let stub = c.env.KIT_AGENT.get(id);
	let doResponse = await stub.fetch(
		new Request("https://kit-agent/sms", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from, body, messageSid }),
		}),
	);

	let { reply } = (await doResponse.json()) as { reply: string };

	let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;
	return c.body(twiml, 200, { "Content-Type": "text/xml" });
});

function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
