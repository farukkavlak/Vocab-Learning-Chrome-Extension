import { CaptionBuffer } from "./buffer";
import { closeOverlays, isPanelOpen, openPanel } from "./panel";
import { sourceFor } from "./sources";

interface LookupMessage {
  type: "LOOKUP_SUBTITLE";
}

const source = sourceFor(location.href);

if (source) {
  const buffer = new CaptionBuffer();
  source.attach((line) => buffer.push(line));

  const resume = (): void => {
    void source.getVideo()?.play();
  };

  const dismiss = (): void => {
    closeOverlays();
    resume();
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
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

    const lines = linesToShow();
    if (!lines) {
      return;
    }

    source.getVideo()?.pause();
    openPanel({
      ...lines,
      captionRect: source.getCaptionRect(),
      captionElement: source.getCaptionElement(),
    });
  });
}
