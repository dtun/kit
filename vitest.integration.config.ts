import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineWorkersConfig({
	plugins: [tsconfigPaths()],
	test: {
		name: "integration",
		include: ["test/integration/**/*.test.ts"],
		poolOptions: {
			workers: {
				wrangler: {
					configPath: "./wrangler.jsonc",
				},
			},
		},
	},
});
