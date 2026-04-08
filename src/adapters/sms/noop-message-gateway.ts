import type { IMessageGateway } from "@application/ports/message-gateway";
import type { KitResponse } from "@domain/entities/kit-message";

export class NoOpMessageGateway implements IMessageGateway {
	async send(_response: KitResponse): Promise<void> {}
}
