import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Tests unitarios y de componentes. Los e2e (Playwright) viven en tests/e2e.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "tests/data/**/*.test.ts"],
      restoreMocks: true,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/vite-env.d.ts"],
        reporter: ["text-summary", "html"],
        // la lógica pura vive en src/lib: ahí se exige cobertura alta (9A)
        thresholds: {
          "src/lib/**": { branches: 90, functions: 95, lines: 95, statements: 95 },
        },
      },
    },
  }),
);
