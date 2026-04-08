export const FAMILY_MEMBERS = [
	{ name: "Danny", contact: "danny@example.com", channel: "email" as const },
	{ name: "Wife", contact: "wife@example.com", channel: "email" as const },
] as const;

export const KIT = {
	name: "Kit",
	fullName: "Kinetic Intelligence Tool",
	email: "kit@kitkit.dev",
	version: "0.1.0",
} as const;

export const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const JOURNAL_CONFIG = {
	rootPrefix: "journal/",
	archiveAfterDays: 60,
	futureLogMonths: 3,
} as const;
