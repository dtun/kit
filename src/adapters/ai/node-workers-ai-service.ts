import {
	CompletionResponse,
	buildClassificationSystemPrompt,
	parseClassificationJson,
} from "@adapters/ai/intent-prompt";
import type { IAIService } from "@application/ports/ai-service";
import type { MessageClassification } from "@domain/entities/intent";

export class EvalConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EvalConfigError";
	}
}

export interface NodeWorkersAIConfig {
	apiToken: string;
	accountId: string;
	model: string;
}

let CF_API_BASE = "https://api.cloudflare.com/client/v4";

export class NodeWorkersAIService implements IAIService {
	private apiToken: string;
	private accountId: string;
	private model: string;

	constructor(config: NodeWorkersAIConfig) {
		if (!config.apiToken) {
			throw new EvalConfigError(
				"NodeWorkersAIService requires apiToken (set CLOUDFLARE_API_TOKEN)",
			);
		}
		if (!config.accountId) {
			throw new EvalConfigError(
				"NodeWorkersAIService requires accountId (set CLOUDFLARE_ACCOUNT_ID)",
			);
		}
		this.apiToken = config.apiToken;
		this.accountId = config.accountId;
		this.model = config.model;
	}

	async complete(systemPrompt: string, userMessage: string): Promise<string> {
		let url = `${CF_API_BASE}/accounts/${this.accountId}/ai/run/${this.model}`;
		let body = JSON.stringify({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
		});

		// Errors surface loudly — evals need to see auth/scope/endpoint
		// failures instead of silently scoring as "unknown".
		let res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiToken}`,
				"Content-Type": "application/json",
			},
			body,
		});

		if (!res.ok) {
			let errText = await res.text().catch(() => "<no body>");
			throw new Error(
				`Cloudflare Workers AI request failed: ${res.status} ${res.statusText} — ${errText}`,
			);
		}

		let raw = await res.json();

		// Cloudflare REST envelope: { result: { response: ... }, success: true }
		let envelope = raw as { result?: unknown; success?: boolean; errors?: unknown } | null;
		if (!envelope || envelope.success === false || !envelope.result) {
			throw new Error(
				`Cloudflare Workers AI envelope reported failure: ${JSON.stringify(envelope)}`,
			);
		}

		let parsed = CompletionResponse.safeParse(envelope.result);
		if (!parsed.success) return "";
		let response = parsed.data.response;
		if (typeof response === "object" && response !== null) {
			return JSON.stringify(response);
		}
		return response || parsed.data.content || "";
	}

	async classifyIntent(userMessage: string, context: string): Promise<MessageClassification> {
		let systemPrompt = buildClassificationSystemPrompt(context);
		let raw = await this.complete(systemPrompt, userMessage);
		return parseClassificationJson(raw);
	}
}
