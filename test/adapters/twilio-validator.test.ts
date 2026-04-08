import { validateTwilioSignature } from "@adapters/sms/twilio-validator";
import { describe, expect, it } from "vitest";

async function computeSignature(
	authToken: string,
	url: string,
	params: Record<string, string>,
): Promise<string> {
	let dataString =
		url +
		Object.keys(params)
			.sort()
			.map((k) => k + params[k])
			.join("");
	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(authToken),
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	let sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataString));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe("validateTwilioSignature", () => {
	let authToken = "test-auth-token-12345";
	let url = "https://kitkit.dev/sms/webhook";
	let params = {
		From: "+14805551234",
		Body: "Hello Kit",
		MessageSid: "SM1234567890",
	};

	it("returns true for a valid signature", async () => {
		let signature = await computeSignature(authToken, url, params);
		let result = await validateTwilioSignature(authToken, signature, url, params);
		expect(result).toBe(true);
	});

	it("returns false for an invalid signature", async () => {
		let result = await validateTwilioSignature(authToken, "bad-signature", url, params);
		expect(result).toBe(false);
	});

	it("returns false when signature header is missing", async () => {
		let result = await validateTwilioSignature(authToken, "", url, params);
		expect(result).toBe(false);
	});

	it("returns true when authToken is empty (dev mode bypass)", async () => {
		let result = await validateTwilioSignature("", "any-signature", url, params);
		expect(result).toBe(true);
	});

	it("constructs data string from URL + sorted params", async () => {
		let unsortedParams = {
			Zebra: "last",
			Alpha: "first",
			Middle: "mid",
		};
		let signature = await computeSignature(authToken, url, unsortedParams);
		let result = await validateTwilioSignature(authToken, signature, url, unsortedParams);
		expect(result).toBe(true);
	});
});
