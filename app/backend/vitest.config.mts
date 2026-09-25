import "dotenv/config";
import { defineConfig } from "vitest/config";
import { UPLOADS_DIR_TESTE, urlDoBancoDeTeste } from "./tests/setup/test-env.mts";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    env: {
      DATABASE_URL: urlDoBancoDeTeste(),
      UPLOADS_DIR: UPLOADS_DIR_TESTE,
      JWT_SECRET: "segredo-de-teste",
      NODE_ENV: "test",
    },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
