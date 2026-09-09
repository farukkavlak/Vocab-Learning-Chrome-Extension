import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// The popup is a third bundle: unlike the content script it may be a module, and unlike
// the worker it has a page of its own to carry with it.
export default defineConfig({
  publicDir: false,
  plugins: [
    {
      name: "emit-page",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "settings.html",
          source: readFileSync("src/settings/settings.html", "utf8"),
        });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "chrome114",
    minify: false,
    lib: {
      entry: "src/settings/index.ts",
      formats: ["es"],
      fileName: () => "settings.js",
    },
  },
});
