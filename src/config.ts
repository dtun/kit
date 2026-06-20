import type { FamilyMember } from "@domain/entities/family-member";
import { z } from "zod";

let FamilyMemberSchema = z.array(
	z.object({
		name: z.string(),
		contact: z.string(),
		aliases: z.array(z.string()).optional(),
		channel: z.enum(["email", "sms"]),
	}),
);

export function parseFamilyMembers(raw: string): FamilyMember[] {
	return FamilyMemberSchema.parse(JSON.parse(raw));
}

export type FamilyMembersParse =
	| { ok: true; members: FamilyMember[] }
	| { ok: false; error: string };

export function parseFamilyMembersSafe(raw: string | undefined): FamilyMembersParse {
	if (raw === undefined || raw.trim() === "") {
		return { ok: false, error: "FAMILY_MEMBERS is not set" };
	}

	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return { ok: false, error: "FAMILY_MEMBERS is not valid JSON" };
	}

	let parsed = FamilyMemberSchema.safeParse(json);
	if (!parsed.success) {
		return {
			ok: false,
			error: `FAMILY_MEMBERS does not match expected schema: ${parsed.error.message}`,
		};
	}

	return { ok: true, members: parsed.data };
}

export let KIT = {
	name: "Kit",
	fullName: "Kinetic Intelligence Tool",
	email: "kit@kitkit.dev",
	version: "0.1.0",
};

export const AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export const ANTHROPIC_MODEL = "claude-opus-4-8";

export let JOURNAL_CONFIG = {
	rootPrefix: "journal/",
	archiveAfterDays: 60,
	futureLogMonths: 3,
};
