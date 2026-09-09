import { defineConfig } from "vite";
import manifest from "./manifest.config";

// The service worker and the content script are bundled separately because a content
// script cannot be an ES module: it has to be one self-contained IIFE.
// This config owns copying public/ and clearing dist/; the content one does not.
export default defineConfig({
  plugins: [
    {
      name: "emit-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: JSON.stringify(manifest, null, 2),
        });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome114",
    minify: false,
    lib: {
      entry: "src/background.ts",
      formats: ["iife"],
      name: "background",
      fileName: () => "background.js",
    },
  },
});
