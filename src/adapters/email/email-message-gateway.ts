import type { IMessageGateway } from "@application/ports/message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";

/**
 * Thrown when the underlying email send fails (e.g. the recipient is not a
 * verified Email Routing destination). Callers can recognize this to tell a
 * reply-delivery failure apart from a processing failure.
 */
export class EmailSendError extends Error {
	constructor(
		message: string,
		readonly cause: unknown,
	) {
		super(message);
		this.name = "EmailSendError";
	}
}

export class EmailMessageGateway implements IMessageGateway {
	private sendEmail: SendEmail;
	private kitEmail: string;
	private kitName: string;
	private inReplyTo?: string;

	constructor(sendEmail: SendEmail, kitEmail: string, kitName: string, inReplyTo?: string) {
		this.sendEmail = sendEmail;
		this.kitEmail = kitEmail;
		this.kitName = kitName;
		this.inReplyTo = inReplyTo;
	}

	async send(response: KitResponse): Promise<void> {
		let headers: Record<string, string> = {};
		if (this.inReplyTo) {
			headers["In-Reply-To"] = this.inReplyTo;
			headers.References = this.inReplyTo;
		}

		try {
			await this.sendEmail.send({
				from: this.kitEmail,
				to: response.to,
				subject: response.subject || `From ${this.kitName}`,
				text: response.body,
				headers,
			});
		} catch (err) {
			console.error("EMAIL_SEND_FAILED", { to: response.to }, err);
			throw new EmailSendError(`Failed to send email to ${response.to}`, err);
		}
	}
}
