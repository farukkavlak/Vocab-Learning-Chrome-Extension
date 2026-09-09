import { CaptionBuffer } from "./buffer";
import { closeOverlays, openPanel } from "./panel";
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      dismiss();
    }
  });

  chrome.runtime.onMessage.addListener((message: LookupMessage) => {
    if (message.type !== "LOOKUP_SUBTITLE") {
      return;
    }

    // Whatever is on screen, or the last line seen if the caption has already cleared.
    const text = source.readCurrent() || buffer.last?.text;
    if (!text) {
      return;
    }

    source.getVideo()?.pause();
    openPanel(text, resume);
  });
}
