import type { EmailStructure, ForwardedEmailContent } from "@domain/entities/forwarded-email";

// Parses an inbound message body into a user instruction + forwarded payload,
// covering Apple Mail, Gmail, Outlook, and bare embedded-headers formats.

// Apple Mail / iOS, Gmail, Outlook
const FORWARD_MARKERS = [
	"Begin forwarded message:",
	"---------- Forwarded message",
	"-------- Original Message",
];

export function parseForwardedEmail(rawBody: string): EmailStructure {
	// Split at the earliest marker of any kind. A forwarded body can itself contain
	// another client's marker, and splitting there would put forwarded text in the
	// user's instruction.
	let earliest: { index: number; marker: string } | undefined;
	for (let marker of FORWARD_MARKERS) {
		let index = rawBody.indexOf(marker);
		if (index !== -1 && (!earliest || index < earliest.index)) {
			earliest = { index, marker };
		}
	}
	if (earliest) {
		return splitAtForward(rawBody, earliest.index, earliest.marker);
	}

	// Pattern 4: bare embedded headers — From: + Subject: with no marker
	let hasEmbeddedHeaders = /^From:.+/m.test(rawBody) && /^Subject:.+/m.test(rawBody);
	if (hasEmbeddedHeaders) {
		let fromIndex = rawBody.search(/^From:/m);
		return splitAtForward(rawBody, fromIndex, "");
	}

	return {
		userInstruction: rawBody.trim(),
		forwardedContent: null,
		isForward: false,
		rawBody,
	};
}

function splitAtForward(rawBody: string, splitIndex: number, marker: string): EmailStructure {
	let userInstruction = rawBody.slice(0, splitIndex).trim();
	let forwardBlock = rawBody.slice(splitIndex + marker.length).trim();

	// Strip common mobile signatures from the user instruction
	userInstruction = userInstruction
		.replace(/Sent from my iPhone/gi, "")
		.replace(/Sent from my iPad/gi, "")
		.replace(/Sent from Mail for Windows/gi, "")
		.trim();

	let forwardedContent = parseForwardBlock(forwardBlock);

	return {
		userInstruction: userInstruction || "forwarded without comment",
		forwardedContent,
		isForward: true,
		rawBody,
	};
}

function parseForwardBlock(block: string): ForwardedEmailContent {
	let from = extractHeader(block, "From") || "unknown";
	let to = extractHeader(block, "To") || undefined;
	let date = extractHeader(block, "Date") || undefined;
	let subject = extractHeader(block, "Subject") || undefined;

	let lines = block.split("\n");
	let bodyStartIndex = 0;

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();
		if (line === "" || (!line.match(/^[A-Za-z-]+:/) && !line.startsWith(">"))) {
			bodyStartIndex = i;
			while (bodyStartIndex < lines.length && lines[bodyStartIndex].trim() === "") {
				bodyStartIndex++;
			}
			break;
		}
	}

	let body = lines.slice(bodyStartIndex).join("\n").trim();

	return { from, to, date, subject, body };
}

function extractHeader(block: string, headerName: string): string | null {
	let regex = new RegExp(`^${headerName}:\\s*(.+)`, "mi");
	let match = block.match(regex);
	if (!match) return null;
	return match[1].replace(/<([^>]+)>/g, "$1").trim();
}
