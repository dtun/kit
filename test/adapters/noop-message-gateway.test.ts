import { NoOpMessageGateway } from "@adapters/sms/noop-message-gateway";
import { describe, expect, it } from "vitest";

describe("NoOpMessageGateway", () => {
	it("send() resolves without error", async () => {
		const gateway = new NoOpMessageGateway();
		await expect(
			gateway.send({
				to: "+14805551234",
				channel: "sms",
				body: "Test message",
				timestamp: new Date().toISOString(),
			}),
		).resolves.toBeUndefined();
	});
});
