import { getHealth } from "@application/use-cases/get-health";
import { describe, expect, it } from "vitest";

describe("GetHealth use case", () => {
	it("returns ok status with Kit identity", () => {
		let health = getHealth();
		expect(health.status).toBe("ok");
		expect(health.name).toBe("Kit");
		expect(health.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(health.timestamp).toBeDefined();
	});
});
