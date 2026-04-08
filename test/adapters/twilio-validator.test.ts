import { describe, expect, it } from "vitest";
import { validateTwilioSignature } from "@adapters/sms/twilio-validator";

async function computeSignature(
	authToken: string,
	url: string,
	params: Record<string, string>,
): Promise<string> {
	const dataString =
		url +
		Object.keys(params)
			.sort()
			.map((k) => k + params[k])
			.join("");
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(authToken),
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataString));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe("validateTwilioSignature", () => {
	const authToken = "test-auth-token-12345";
	const url = "https://kitkit.dev/sms/webhook";
	const params = {
		From: "+14805551234",
		Body: "Hello Kit",
		MessageSid: "SM1234567890",
	};

	it("returns true for a valid signature", async () => {
		const signature = await computeSignature(authToken, url, params);
		const result = await validateTwilioSignature(authToken, signature, url, params);
		expect(result).toBe(true);
	});

	it("returns false for an invalid signature", async () => {
		const result = await validateTwilioSignature(authToken, "bad-signature", url, params);
		expect(result).toBe(false);
	});

	it("returns false when signature header is missing", async () => {
		const result = await validateTwilioSignature(authToken, "", url, params);
		expect(result).toBe(false);
	});

	it("returns true when authToken is empty (dev mode bypass)", async () => {
		const result = await validateTwilioSignature("", "any-signature", url, params);
		expect(result).toBe(true);
	});

	it("constructs data string from URL + sorted params", async () => {
		const unsortedParams = {
			Zebra: "last",
			Alpha: "first",
			Middle: "mid",
		};
		const signature = await computeSignature(authToken, url, unsortedParams);
		const result = await validateTwilioSignature(authToken, signature, url, unsortedParams);
		expect(result).toBe(true);
	});
});
