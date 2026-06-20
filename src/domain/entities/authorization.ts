import type { FamilyMember } from "./family-member";

export interface AuthorizationResult {
	readonly authorized: boolean;
	readonly member: FamilyMember | null;
	readonly reason?: string;
}

function extractAddress(sender: string): string {
	let match = sender.match(/<([^>]*)>/);
	return match ? match[1] : sender;
}

export function authorizeSender(
	senderEmail: string,
	familyMembers: readonly FamilyMember[],
): AuthorizationResult {
	let normalized = extractAddress(senderEmail).toLowerCase().trim();
	let member = familyMembers.find(
		(m) =>
			m.contact.toLowerCase() === normalized ||
			(m.aliases ?? []).some((alias) => alias.toLowerCase() === normalized),
	);

	if (member) {
		return { authorized: true, member: { ...member } };
	}

	return {
		authorized: false,
		member: null,
		reason: `${senderEmail} is not a recognized family member`,
	};
}
