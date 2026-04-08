import type { KitResponse } from "@domain/entities/kit-message";

export interface IMessageGateway {
	send(response: KitResponse): Promise<void>;
}
