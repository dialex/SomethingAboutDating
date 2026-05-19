import { defineConfig } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT || "3000";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: BASE_URL,
    actionTimeout: 1000,
  },
  expect: {
    timeout: 1000,
  },
  webServer: {
    command: `npx serve . --listen ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
