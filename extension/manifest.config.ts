import { sources } from "./src/content/sources";

// The single place platforms are declared: adding an adapter updates the manifest too.
const matches = sources.flatMap((source) => [...source.hostPatterns]);

export default {
  name: "VocabBoost",
  version: "1.0",
  manifest_version: 3,
  description:
    "Vocabulary learning extension powered by AI. Look up a word from the subtitles without leaving the video.",
  host_permissions: [...matches, "http://localhost:3000/*"],
  background: {
    service_worker: "background.js",
  },
  commands: {
    "lookup-subtitle": {
      suggested_key: {
        default: "Ctrl+Shift+H",
        mac: "Command+Shift+H",
      },
      description: "Look up a word from the current subtitle line",
    },
  },
  content_scripts: [
    {
      matches,
      js: ["content.js"],
    },
  ],
  icons: {
    "16": "logo.png",
    "32": "logo.png",
    "48": "logo.png",
    "128": "logo.png",
  },
};
