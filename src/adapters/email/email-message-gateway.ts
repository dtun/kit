import type { IMessageGateway } from "@application/ports/message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";

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
		const headers: Record<string, string> = {};
		if (this.inReplyTo) {
			headers["In-Reply-To"] = this.inReplyTo;
			headers.References = this.inReplyTo;
		}

		await this.sendEmail.send({
			from: this.kitEmail,
			to: response.to,
			subject: response.subject || `From ${this.kitName}`,
			text: response.body,
			headers,
		});
	}
}
