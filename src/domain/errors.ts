export class KitDomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "KitDomainError";
	}
}

export class UnauthorizedSenderError extends KitDomainError {
	constructor(sender: string) {
		super(`Unauthorized sender: ${sender}`);
		this.name = "UnauthorizedSenderError";
	}
}

export class JournalEntryNotFoundError extends KitDomainError {
	constructor(path: string) {
		super(`Journal entry not found: ${path}`);
		this.name = "JournalEntryNotFoundError";
	}
}
