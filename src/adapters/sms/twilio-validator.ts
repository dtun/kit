export async function validateTwilioSignature(
	authToken: string,
	signature: string,
	url: string,
	params: Record<string, string>,
): Promise<boolean> {
	if (!authToken) {
		return true;
	}

	if (!signature) {
		return false;
	}

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
	const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

	return signature === expected;
}
