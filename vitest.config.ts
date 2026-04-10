import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Root vitest config is eval-only. Evalite auto-discovers this file
// when it calls createVitest(), so it MUST NOT reference the unit or
// integration projects — doing so would make Evalite try to run every
// *.test.ts file (including the Cloudflare Workers pool ones) as an
// eval, which can't execute from the Node-side Evalite runtime.
//
// The unit and integration vitest projects are selected explicitly via
// `--config` in their respective npm scripts.
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		name: "eval",
		include: ["eval/**/*.eval.ts"],
		exclude: ["test/**", "node_modules/**", ".wrangler/**"],
		environment: "node",
	},
});
