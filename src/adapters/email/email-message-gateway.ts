import type { IMessageGateway } from "@application/ports/message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";
import { buildReplyEmail } from "./email-reply";

// EmailMessage is a runtime global in Workers but only exported as a type
// from @cloudflare/workers-types. Declare it here for use as a constructor.
declare const EmailMessage: {
	new (from: string, to: string, raw: ReadableStream | string): EmailMessage;
};

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
		const rawEmail = buildReplyEmail(response, this.kitEmail, this.kitName, this.inReplyTo);
		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(rawEmail));
				controller.close();
			},
		});

		const msg = new EmailMessage(this.kitEmail, response.to, stream);
		await this.sendEmail.send(msg);
	}
}
