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
	let expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

	return signature === expected;
}
