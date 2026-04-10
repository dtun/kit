import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		name: "unit",
		include: [
			"test/domain/**/*.test.ts",
			"test/application/**/*.test.ts",
			"test/adapters/**/*.test.ts",
			"test/eval/**/*.test.ts",
		],
		exclude: ["eval/**", "node_modules/**"],
	},
});
