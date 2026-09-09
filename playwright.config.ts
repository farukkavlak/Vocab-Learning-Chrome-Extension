import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // The extension runs in a persistent context, which cannot be shared across workers.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  // Live tests hit youtube.com (`npm run test:live`); the shot spec only writes images
  // for review (`npm run shots`). Neither belongs in the deterministic suite.
  grepInvert: [
    ...(process.env.LIVE ? [] : [/@live/]),
    ...(process.env.SHOTS ? [] : [/@shots/]),
  ],
  use: {
    trace: "retain-on-failure",
  },
});
