import { domCaptionSource } from "./dom-caption-source";

// Selectors not verified against a live Netflix session yet.
export const netflix = domCaptionSource({
  id: "netflix",
  hostPatterns: ["*://*.netflix.com/*"],
  containerSelector: ".player-timedtext",
  segmentSelector: ".player-timedtext-text-container",
});
