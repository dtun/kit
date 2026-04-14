import type { FamilyMember } from "@domain/entities/family-member";
import { z } from "zod";

let FamilyMemberSchema = z.array(
	z.object({
		name: z.string(),
		contact: z.string(),
		channel: z.enum(["email", "sms"]),
	}),
);

export function parseFamilyMembers(raw: string): FamilyMember[] {
	return FamilyMemberSchema.parse(JSON.parse(raw));
}

export let KIT = {
	name: "Kit",
	fullName: "Kinetic Intelligence Tool",
	email: "kit@kitkit.dev",
	version: "0.1.0",
};

export const AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export let JOURNAL_CONFIG = {
	rootPrefix: "journal/",
	archiveAfterDays: 60,
	futureLogMonths: 3,
};
