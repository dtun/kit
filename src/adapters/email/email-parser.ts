import type { KitMessage } from "@domain/entities/kit-message";
import PostalMime from "postal-mime";

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

	let parser = new PostalMime();
	let parsed = await parser.parse(bytes);

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

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	let reader = stream.getReader();
	let chunks: Uint8Array[] = [];
	for (;;) {
		let { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	let total = chunks.reduce((acc, c) => acc + c.length, 0);
	let result = new Uint8Array(total);
	let offset = 0;
	for (let chunk of chunks) {
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
	let lines = text.split("\n");
	let cleaned: string[] = [];
	let hitQuoteBlock = false;
	let forwardMarkers = [
		"Begin forwarded message:",
		"---------- Forwarded",
		"-------- Original Message",
	];

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];
		let trimmed = line.trim();

		// Forwarded content IS the message — preserve everything from the marker on
		if (forwardMarkers.some((m) => trimmed.startsWith(m))) {
			cleaned.push(...lines.slice(i));
			break;
		}

		// Top-level reply chain — strip from here
		if (/^On .+ wrote:$/i.test(trimmed)) break;

		if (line.startsWith(">")) {
			hitQuoteBlock = true;
			continue;
		}
		if (hitQuoteBlock && trimmed === "") continue;
		hitQuoteBlock = false;
		cleaned.push(line);
	}

	return cleaned.join("\n");
}
