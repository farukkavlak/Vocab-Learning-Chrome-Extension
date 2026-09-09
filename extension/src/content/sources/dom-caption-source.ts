import type { CaptionSource } from "../caption-source";
import { matchPatternToRegExp } from "./match-pattern";

const CONTAINER_POLL_MS = 1000;

interface DomCaptionSourceOptions {
  id: string;
  hostPatterns: readonly string[];
  containerSelector: string;
  segmentSelector: string;
}

/**
 * Every platform so far renders captions the same way: a container element that is
 * created and destroyed as subtitles are toggled, holding one element per segment.
 */
export function domCaptionSource(
  options: DomCaptionSourceOptions,
): CaptionSource {
  const hostMatchers = options.hostPatterns.map(matchPatternToRegExp);

  const getVideo = (): HTMLVideoElement | null =>
    document.querySelector("video");

  const findContainer = (): Element | null =>
    document.querySelector(options.containerSelector);

  const readCaption = (container: Element): string => {
    // Joined explicitly: textContent glues segments together, and innerText separates
    // them only when their CSS happens to be block-level.
    const segments = container.querySelectorAll(options.segmentSelector);
    const text = segments.length
      ? Array.from(segments, (segment) => segment.textContent ?? "").join(" ")
      : (container as HTMLElement).innerText;

    return text.replace(/\s+/g, " ").trim();
  };

  return {
    id: options.id,
    hostPatterns: options.hostPatterns,
    getVideo,

    matches: (url) => hostMatchers.some((matcher) => matcher.test(url)),

    readCurrent() {
      const container = findContainer();
      return container ? readCaption(container) : "";
    },

    attach(onLine) {
      let observed: Element | null = null;
      let observer: MutationObserver | null = null;

      const report = (container: Element): void => {
        const text = readCaption(container);
        if (text) {
          onLine({ text, at: getVideo()?.currentTime ?? 0 });
        }
      };

      const detachObserver = (): void => {
        observer?.disconnect();
        observer = null;
        observed = null;
      };

      // The container comes and goes with the subtitle toggle and SPA navigation.
      // Polling for it beats observing the whole document, which fires constantly.
      const sync = (): void => {
        const container = findContainer();
        if (container === observed) {
          return;
        }

        detachObserver();
        if (!container) {
          return;
        }

        observed = container;
        observer = new MutationObserver(() => report(container));
        observer.observe(container, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        report(container);
      };

      sync();
      const timer = setInterval(sync, CONTAINER_POLL_MS);

      return () => {
        clearInterval(timer);
        detachObserver();
      };
    },
  };
}
