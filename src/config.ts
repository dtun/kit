import type { FamilyMember } from "@domain/entities/family-member";
import { z } from "zod";

const FamilyMemberSchema = z.array(
	z.object({
		name: z.string(),
		contact: z.string(),
		channel: z.enum(["email", "sms"]),
	}),
);

export function parseFamilyMembers(raw: string): FamilyMember[] {
	return FamilyMemberSchema.parse(JSON.parse(raw));
}

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
