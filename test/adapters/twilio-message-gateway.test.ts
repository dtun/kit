import { TwilioMessageGateway } from "@adapters/sms/twilio-message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("TwilioMessageGateway", () => {
	let originalFetch: typeof globalThis.fetch;
	let mockFetch: MockInstance;

	const response: KitResponse = {
		to: "+14805551234",
		channel: "sms",
		body: "Hey, soccer at 10am tomorrow.",
		timestamp: new Date().toISOString(),
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		mockFetch = vi.fn().mockResolvedValue({ ok: true });
		globalThis.fetch = mockFetch as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("sends POST to Twilio API with correct URL", async () => {
		const gateway = new TwilioMessageGateway("AC123", "token", "+18335551234");
		await gateway.send(response);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("api.twilio.com");
		expect(url).toContain("AC123");
	});

	it("uses Basic auth header", async () => {
		const gateway = new TwilioMessageGateway("AC123", "token", "+18335551234");
		await gateway.send(response);

		const [, opts] = mockFetch.mock.calls[0];
		const expectedAuth = btoa("AC123:token");
		expect(opts.headers.Authorization).toBe(`Basic ${expectedAuth}`);
	});

	it("sends form-encoded body with To, From, Body", async () => {
		const gateway = new TwilioMessageGateway("AC123", "token", "+18335551234");
		await gateway.send(response);

		const [, opts] = mockFetch.mock.calls[0];
		expect(opts.method).toBe("POST");
		expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

		const body = new URLSearchParams(opts.body);
		expect(body.get("To")).toBe("+14805551234");
		expect(body.get("From")).toBe("+18335551234");
		expect(body.get("Body")).toBe("Hey, soccer at 10am tomorrow.");
	});

	it("throws on Twilio API failure", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		});

		const gateway = new TwilioMessageGateway("AC123", "bad", "+18335551234");

		await expect(gateway.send(response)).rejects.toThrow("Twilio send failed");
	});
});
