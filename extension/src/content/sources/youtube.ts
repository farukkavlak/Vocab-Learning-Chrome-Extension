import { domCaptionSource } from "./dom-caption-source";

export const youtube = domCaptionSource({
  id: "youtube",
  hostPatterns: ["*://*.youtube.com/*"],
  containerSelector: ".ytp-caption-window-container",
  segmentSelector: ".ytp-caption-segment",
});
