import { EvalConfigError, NodeWorkersAIService } from "@adapters/ai/node-workers-ai-service";
import { afterEach, describe, expect, it, vi } from "vitest";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
	let response = {
		ok,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response as unknown as Response));
}

function mockFetchReject(err: Error) {
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("NodeWorkersAIService", () => {
	describe("construction", () => {
		it("throws EvalConfigError when apiToken is missing", () => {
			expect(
				() =>
					new NodeWorkersAIService({
						apiToken: "",
						accountId: "acc",
						model: "@cf/meta/llama-3.1-8b-instruct",
					}),
			).toThrow(EvalConfigError);
		});

		it("throws EvalConfigError when accountId is missing", () => {
			expect(
				() =>
					new NodeWorkersAIService({
						apiToken: "tok",
						accountId: "",
						model: "@cf/meta/llama-3.1-8b-instruct",
					}),
			).toThrow(EvalConfigError);
		});

		it("constructs when all fields are present", () => {
			expect(
				() =>
					new NodeWorkersAIService({
						apiToken: "tok",
						accountId: "acc",
						model: "@cf/meta/llama-3.1-8b-instruct",
					}),
			).not.toThrow();
		});
	});

	describe("complete", () => {
		it("posts to the Cloudflare Workers AI REST endpoint with bearer auth", async () => {
			mockFetchOnce({ result: { response: "hi there" }, success: true });
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "@cf/meta/llama-3.1-8b-instruct",
			});

			await service.complete("sys", "user");

			let fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
			let [url, init] = fetchMock.mock.calls[0];
			expect(url).toBe(
				"https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/meta/llama-3.1-8b-instruct",
			);
			expect(init.method).toBe("POST");
			expect(init.headers.Authorization).toBe("Bearer tok");
			let body = JSON.parse(init.body);
			expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
			expect(body.messages[1]).toEqual({ role: "user", content: "user" });
		});

		it("returns the string response from the REST envelope", async () => {
			mockFetchOnce({ result: { response: "Hello there." }, success: true });
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.complete("sys", "user");

			expect(result).toBe("Hello there.");
		});

		it("JSON-stringifies an object response", async () => {
			mockFetchOnce({
				result: { response: { greeting: "hi", count: 3 } },
				success: true,
			});
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.complete("sys", "user");

			expect(result).toBe('{"greeting":"hi","count":3}');
		});

		it("returns empty string on non-200 response", async () => {
			mockFetchOnce({ errors: ["boom"], success: false }, false, 500);
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.complete("sys", "user");

			expect(result).toBe("");
		});

		it("returns empty string on network error", async () => {
			mockFetchReject(new Error("ECONNRESET"));
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.complete("sys", "user");

			expect(result).toBe("");
		});
	});

	describe("classifyIntent", () => {
		it("parses a valid JSON envelope", async () => {
			mockFetchOnce({
				result: {
					response:
						'{"intent":"recall","confidence":0.85,"extractedData":{"content":"plumber","tags":["home"]}}',
				},
				success: true,
			});
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.classifyIntent("What's the plumber?", "");

			expect(result.intent).toBe("recall");
			expect(result.confidence).toBe(0.85);
			expect(result.extractedData.content).toBe("plumber");
		});

		it("accepts an object-typed response field", async () => {
			mockFetchOnce({
				result: {
					response: {
						intent: "remember",
						confidence: 0.95,
						extractedData: {
							content: "Belt test April 18",
							date: "2026-04-18",
							tags: ["bjj"],
						},
					},
				},
				success: true,
			});
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.classifyIntent("forwarded body", "");

			expect(result.intent).toBe("remember");
			expect(result.confidence).toBe(0.95);
			expect(result.extractedData.date).toBe("2026-04-18");
		});

		it("returns unknown/0 on network error", async () => {
			mockFetchReject(new Error("offline"));
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let result = await service.classifyIntent("hi", "");

			expect(result.intent).toBe("unknown");
			expect(result.confidence).toBe(0);
		});

		it("truncates context to 2000 chars in the system prompt sent to the API", async () => {
			mockFetchOnce({
				result: { response: '{"intent":"greeting","confidence":0.9,"extractedData":{"tags":[]}}' },
				success: true,
			});
			let service = new NodeWorkersAIService({
				apiToken: "tok",
				accountId: "acc",
				model: "m",
			});

			let longContext = "x".repeat(5000);
			await service.classifyIntent("hi", longContext);

			let fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
			let [, init] = fetchMock.mock.calls[0];
			let sentSystem = JSON.parse(init.body).messages[0].content;
			expect(sentSystem).toContain("x".repeat(2000));
			expect(sentSystem).not.toContain("x".repeat(5000));
		});
	});
});
