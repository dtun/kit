import type { IMessageGateway } from "@application/ports/message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";

export class TwilioMessageGateway implements IMessageGateway {
	constructor(
		private accountSid: string,
		private authToken: string,
		private fromNumber: string,
	) {}

	async send(response: KitResponse): Promise<void> {
		const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

		const body = new URLSearchParams({
			To: response.to,
			From: this.fromNumber,
			Body: response.body,
		});

		const auth = btoa(`${this.accountSid}:${this.authToken}`);

		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		});

		if (!res.ok) {
			const err = await res.text();
			throw new Error(`Twilio send failed (${res.status}): ${err}`);
		}
	}
}
