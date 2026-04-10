import { parseForwardedEmail } from "@application/use-cases/parse-forwarded-email";
import { classifyIntent } from "./classify";

// Runs the forwarded-email extraction path used by process-inbound-message:
// parse the forward, build the classification body with user instruction +
// forwarded headers + body, classify, and return a string summary that the
// extraction-quality scorer can do fuzzy word-overlap matching against.
export async function processForward(rawBody: string): Promise<string> {
	let parsed = parseForwardedEmail(rawBody);

	let classificationBody: string;
	if (parsed.isForward && parsed.forwardedContent) {
		let fwd = parsed.forwardedContent;
		classificationBody = [
			`User instruction: "${parsed.userInstruction}"`,
			"",
			`Forwarded email from: ${fwd.from}`,
			fwd.subject ? `Subject: ${fwd.subject}` : "",
			fwd.date ? `Date: ${fwd.date}` : "",
			"",
			`Content: ${fwd.body}`,
		]
			.filter(Boolean)
			.join("\n");
	} else {
		classificationBody = rawBody;
	}

	let result = await classifyIntent(classificationBody);
	let e = result.extractedData;
	return [e.content, e.category, e.person, e.date, (e.tags || []).join(" ")]
		.filter(Boolean)
		.join(" | ");
}
