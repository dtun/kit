import { KIT } from "@config";

export interface HealthStatus {
	status: "ok" | "degraded";
	name: string;
	version: string;
	timestamp: string;
}

export function getHealth(): HealthStatus {
	return {
		status: "ok",
		name: KIT.name,
		version: KIT.version,
		timestamp: new Date().toISOString(),
	};
}
