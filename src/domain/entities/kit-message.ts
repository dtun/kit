import type { Channel } from "./family-member";

export interface KitMessage {
	readonly from: string;
	readonly channel: Channel;
	readonly subject?: string;
	readonly body: string;
	readonly timestamp: string;
	readonly messageId?: string;
}

export interface KitResponse {
	readonly to: string;
	readonly channel: Channel;
	readonly subject?: string;
	readonly body: string;
	readonly timestamp: string;
}
