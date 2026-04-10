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
	maxRetries?: number;
}

let CF_API_BASE = "https://api.cloudflare.com/client/v4";
let DEFAULT_MAX_RETRIES = 3;

// Retryable: rate limits (429) and upstream transient failures (5xx).
// 4xx auth errors should fail fast — retrying won't fix them.
function isRetryableStatus(status: number): boolean {
	return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NodeWorkersAIService implements IAIService {
	private apiToken: string;
	private accountId: string;
	private model: string;
	private maxRetries: number;

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
		this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
	}

	async complete(systemPrompt: string, userMessage: string): Promise<string> {
		let url = `${CF_API_BASE}/accounts/${this.accountId}/ai/run/${this.model}`;
		let body = JSON.stringify({
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
		});

		let raw = await this.fetchWithRetry(url, body);

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

	// Retries 429/5xx with exponential backoff (500ms, 1s, 2s…).
	// Non-retryable errors (4xx auth) throw immediately.
	private async fetchWithRetry(url: string, body: string): Promise<unknown> {
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			let response: Response;
			try {
				response = await fetch(url, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiToken}`,
						"Content-Type": "application/json",
					},
					body,
				});
			} catch (err) {
				// Network error — retry if attempts remain.
				if (attempt === this.maxRetries) throw err;
				await sleep(500 * 2 ** attempt);
				continue;
			}

			if (response.ok) {
				return await response.json();
			}

			let errText = await response.text().catch(() => "<no body>");
			let error = new Error(
				`Cloudflare Workers AI request failed: ${response.status} ${response.statusText} — ${errText}`,
			);

			if (!isRetryableStatus(response.status) || attempt === this.maxRetries) {
				throw error;
			}
			await sleep(500 * 2 ** attempt);
		}
		throw new Error("unreachable");
	}
}
