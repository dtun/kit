import type { EmailStructure, ForwardedEmailContent } from "@domain/entities/forwarded-email";

// Parses an inbound message body into a user instruction + forwarded payload,
// covering Apple Mail, Gmail, Outlook, and bare embedded-headers formats.

export function parseForwardedEmail(rawBody: string): EmailStructure {
	// Pattern 1: Apple Mail / iOS
	let appleIndex = rawBody.indexOf("Begin forwarded message:");
	if (appleIndex !== -1) {
		return splitAtForward(rawBody, appleIndex, "Begin forwarded message:");
	}

	// Pattern 2: Gmail
	let gmailIndex = rawBody.indexOf("---------- Forwarded message");
	if (gmailIndex !== -1) {
		return splitAtForward(rawBody, gmailIndex, "---------- Forwarded message");
	}

	// Pattern 3: Outlook
	let outlookIndex = rawBody.indexOf("-------- Original Message");
	if (outlookIndex !== -1) {
		return splitAtForward(rawBody, outlookIndex, "-------- Original Message");
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
