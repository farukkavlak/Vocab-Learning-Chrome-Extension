import { defineConfig } from "vite";

// Runs after vite.background.config.ts, so it must not clear dist/ or re-copy public/.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "chrome114",
    minify: false,
    lib: {
      entry: "src/content.ts",
      formats: ["iife"],
      name: "content",
      fileName: () => "content.js",
    },
  },
});
