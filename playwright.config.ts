import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // The extension runs in a persistent context, which cannot be shared across workers.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  // Live tests hit youtube.com; opt in with `npm run test:live`.
  grepInvert: process.env.LIVE ? undefined : /@live/,
  use: {
    trace: "retain-on-failure",
  },
});
