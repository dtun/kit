export type Channel = "email" | "sms";

export interface FamilyMember {
	readonly name: string;
	readonly contact: string;
	readonly aliases?: readonly string[];
	readonly channel: Channel;
}
