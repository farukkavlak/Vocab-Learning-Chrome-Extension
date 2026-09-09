import { CaptionBuffer } from "./buffer";
import {
  closeMeaning,
  closeOverlays,
  isInsidePanel,
  isMeaningOpen,
  isPanelOpen,
  openPanel,
} from "./panel";
import { sourceFor } from "./sources";

interface LookupMessage {
  type: "LOOKUP_SUBTITLE";
}

const source = sourceFor(location.href);

if (source) {
  const buffer = new CaptionBuffer();
  source.attach((line) => buffer.push(line));

  // Only what we paused do we start again: the user may have paused the video
  // themselves before asking for a lookup, and resuming it then would be a surprise.
  let paused: HTMLVideoElement | null = null;

  const stopWatchingPlayback = (): void => {
    paused?.removeEventListener("play", onPlay);
    paused = null;
  };

  /**
   * The user can resume the video in ways this extension never hears about: the player's
   * own button, Space, a double click. Whichever it is, the panel has to get out of the
   * way — otherwise the video plays on behind a frozen panel with its captions hidden.
   */
  function onPlay(): void {
    stopWatchingPlayback();
    closeOverlays();
  }

  const dismiss = (): void => {
    const video = paused;
    stopWatchingPlayback();
    closeOverlays();
    void video?.play();
  };

  /**
   * The line the user is reacting to plus the one before it. Reads what is on screen,
   * falling back to the buffer when the caption has already been cleared.
   */
  const linesToShow = (): { text: string; previous?: string } | null => {
    const onScreen = source.readCurrent();
    const recent = buffer.recent(2).map((line) => line.text);
    const lines =
      onScreen && recent[recent.length - 1] !== onScreen
        ? [...recent.slice(-1), onScreen]
        : recent;

    const text = lines[lines.length - 1];
    if (!text) {
      return null;
    }

    return lines.length > 1 ? { text, previous: lines[0] } : { text };
  };

  const open = (): void => {
    const lines = linesToShow();
    if (!lines) {
      return;
    }

    const video = source.getVideo();
    if (video && !video.paused) {
      video.pause();
      video.addEventListener("play", onPlay);
      paused = video;
    }

    openPanel({
      ...lines,
      captionRect: source.getCaptionRect(),
      captionElement: source.getCaptionElement(),
      captionFontSize: source.getCaptionFontSize(),
    });
  };

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isPanelOpen()) {
      return;
    }

    // One step at a time: the card first, then the panel.
    if (isMeaningOpen()) {
      closeMeaning();
      return;
    }

    dismiss();
  });

  // Clicking away is how every overlay is dismissed; the panel should be no different.
  document.addEventListener("click", (event) => {
    if (isPanelOpen() && !isInsidePanel(event.target)) {
      dismiss();
    }
  });

  chrome.runtime.onMessage.addListener((message: LookupMessage) => {
    if (message.type !== "LOOKUP_SUBTITLE") {
      return;
    }

    // The shortcut toggles: pressing it again puts the video back.
    if (isPanelOpen()) {
      dismiss();
      return;
    }

    open();
  });
}
