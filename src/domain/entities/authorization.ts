import type { FamilyMember } from "./family-member";

export interface AuthorizationResult {
	readonly authorized: boolean;
	readonly member: FamilyMember | null;
	readonly reason?: string;
}

export function authorizeSender(
	senderEmail: string,
	familyMembers: readonly FamilyMember[],
): AuthorizationResult {
	let normalized = senderEmail.toLowerCase().trim();
	let member = familyMembers.find((m) => m.contact.toLowerCase() === normalized);

	if (member) {
		return { authorized: true, member: { ...member } };
	}

	return {
		authorized: false,
		member: null,
		reason: `${senderEmail} is not a recognized family member`,
	};
}
