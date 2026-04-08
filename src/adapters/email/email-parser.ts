import PostalMime from "postal-mime";
import type { KitMessage } from "@domain/entities/kit-message";

export async function parseInboundEmail(
	raw: ReadableStream<Uint8Array> | ArrayBuffer,
	from: string,
	to: string,
): Promise<KitMessage> {
	let bytes: Uint8Array;

	if (raw instanceof ArrayBuffer) {
		bytes = new Uint8Array(raw);
	} else {
		bytes = await streamToBytes(raw);
	}

	const parser = new PostalMime();
	const parsed = await parser.parse(bytes);

	// Prefer plain text; fall back to stripped HTML
	let body = parsed.text || "";
	if (!body && parsed.html) {
		body = stripHtml(parsed.html);
	}

	// Remove quoted replies
	body = removeQuotedReplies(body).trim();

	return {
		from: from.toLowerCase().trim(),
		channel: "email",
		subject: parsed.subject || undefined,
		body,
		timestamp: new Date().toISOString(),
		messageId: parsed.messageId || undefined,
	};
}

async function streamToBytes(
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	const total = chunks.reduce((acc, c) => acc + c.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/div>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function removeQuotedReplies(text: string): string {
	const lines = text.split("\n");
	const cleaned: string[] = [];
	let hitQuoteBlock = false;

	for (const line of lines) {
		if (/^On .+ wrote:$/i.test(line.trim())) break;
		if (line.trim().startsWith("---------- Forwarded")) break;
		if (line.startsWith(">")) {
			hitQuoteBlock = true;
			continue;
		}
		if (hitQuoteBlock && line.trim() === "") continue;
		hitQuoteBlock = false;
		cleaned.push(line);
	}

	return cleaned.join("\n");
}
