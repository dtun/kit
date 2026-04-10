import { EmailMessageGateway } from "@adapters/email/email-message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";
import { describe, expect, it, vi } from "vitest";

function createMockSendEmail() {
	return {
		send: vi.fn().mockResolvedValue({ success: true }),
	} as unknown as SendEmail;
}

describe("EmailMessageGateway", () => {
	let response: KitResponse = {
		to: "danny@example.com",
		channel: "email",
		subject: "Re: Hello",
		body: "Got it! - Kit",
		timestamp: new Date().toISOString(),
	};

	it("calls sendEmail.send with correct from/to/subject/body", async () => {
		let mockSend = createMockSendEmail();
		let gateway = new EmailMessageGateway(mockSend, "kit@kitkit.dev", "Kit");

		await gateway.send(response);

		expect(mockSend.send).toHaveBeenCalledOnce();
		let arg = vi.mocked(mockSend.send).mock.calls[0][0];
		expect(arg).toMatchObject({
			from: "kit@kitkit.dev",
			to: "danny@example.com",
			subject: "Re: Hello",
			text: "Got it! - Kit",
		});
	});

	it("includes In-Reply-To header when inReplyTo is provided", async () => {
		let mockSend = createMockSendEmail();
		let gateway = new EmailMessageGateway(
			mockSend,
			"kit@kitkit.dev",
			"Kit",
			"<original-msg-id@example.com>",
		);

		await gateway.send(response);

		let arg = vi.mocked(mockSend.send).mock.calls[0][0];
		expect(arg).toMatchObject({
			headers: {
				"In-Reply-To": "<original-msg-id@example.com>",
				References: "<original-msg-id@example.com>",
			},
		});
	});
});
