import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        globalSetup: ["./test/src/setup.ts"],
        include: ["./test/src/*.test.ts"],
        coverage: {
            reportsDirectory: ".coverage/",
            provider: "v8",
            reporter: ["text", "json", "html", "lcov"],
            exclude: ["node_modules/", "dist/", "**/*.d.ts", "**/*.test.ts", "**/*.test.tsx", "**/index.ts"],
            thresholds: {
                100: true,
            },
        },
    },
});
