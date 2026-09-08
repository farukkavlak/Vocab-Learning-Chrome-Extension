import { defineConfig } from "vite";

// The service worker and the content script are bundled separately because a
// content script cannot be an ES module: it has to be one self-contained IIFE.
// This config owns copying public/ and clearing dist/; the content one does not.
export default defineConfig({
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
