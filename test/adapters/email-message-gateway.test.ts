import { EmailMessageGateway, EmailSendError } from "@adapters/email/email-message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";
import { afterEach, describe, expect, it, vi } from "vitest";

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

	describe("when the underlying send fails", () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("logs a distinct EMAIL_SEND_FAILED diagnostic", async () => {
			let errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			let underlying = new Error("destination not verified");
			let mockSend = {
				send: vi.fn().mockRejectedValue(underlying),
			} as unknown as SendEmail;
			let gateway = new EmailMessageGateway(mockSend, "kit@kitkit.dev", "Kit");

			await expect(gateway.send(response)).rejects.toThrow();

			expect(errorSpy).toHaveBeenCalledWith(
				"EMAIL_SEND_FAILED",
				{ to: "danny@example.com" },
				underlying,
			);
		});

		it("rejects with an EmailSendError so callers can recognize it", async () => {
			vi.spyOn(console, "error").mockImplementation(() => {});
			let mockSend = {
				send: vi.fn().mockRejectedValue(new Error("destination not verified")),
			} as unknown as SendEmail;
			let gateway = new EmailMessageGateway(mockSend, "kit@kitkit.dev", "Kit");

			await expect(gateway.send(response)).rejects.toBeInstanceOf(EmailSendError);
		});
	});
});
