// Value objects describing the structure of an inbound message that may
// contain a forwarded email. The user's instruction (e.g., "Note this date
// for me!") sits above the forwarded block; the forwarded content is the
// payload to act on.

export interface ForwardedEmailContent {
	readonly from: string;
	readonly to?: string;
	readonly date?: string;
	readonly subject?: string;
	readonly body: string;
}

export interface EmailStructure {
	readonly userInstruction: string;
	readonly forwardedContent: ForwardedEmailContent | null;
	readonly isForward: boolean;
	readonly rawBody: string;
}
