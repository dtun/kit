import { defineConfig } from "evalite/config";

// Keep concurrency modest — Cloudflare Workers AI throttles the free tier
// and returns 429 "model temporarily unavailable" under load. The adapter
// retries with backoff, but lower concurrency avoids most retries.
export default defineConfig({
	maxConcurrency: 2,
	testTimeout: 60000,
});
