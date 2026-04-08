import type { KitResponse } from "@domain/entities/kit-message";

export function buildReplyEmail(
	response: KitResponse,
	kitEmail: string,
	kitName: string,
	inReplyTo?: string,
): string {
	let messageId = `<${crypto.randomUUID()}@kitkit.dev>`;
	let subject = response.subject || `From ${kitName}`;

	let headers = [
		`From: ${kitName} <${kitEmail}>`,
		`To: ${response.to}`,
		`Subject: ${subject}`,
		`Message-ID: ${messageId}`,
		`Date: ${new Date().toUTCString()}`,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 7bit",
	];

	if (inReplyTo) {
		headers.push(`In-Reply-To: ${inReplyTo}`);
		headers.push(`References: ${inReplyTo}`);
	}

	return `${headers.join("\r\n")}\r\n\r\n${response.body}`;
}
