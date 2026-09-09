const SERVER_URL = "http://localhost:3000";

// YouTube only for now; Phase 4 turns this into a per-platform adapter.
const CAPTION_CONTAINER_SELECTOR = ".ytp-caption-window-container";
const CAPTION_SEGMENT_SELECTOR = ".ytp-caption-segment";

const BUFFER_SIZE = 5;
const CONTAINER_POLL_MS = 1000;
const PANEL_ID = "vocab-container";

interface CaptionLine {
  text: string;
  at: number;
}

interface LookupMessage {
  type: "LOOKUP_SUBTITLE";
}

// Kept because the caption is cleared between lines: by the time the user reacts to a
// word, the line they saw may already be gone from the DOM.
const buffer: CaptionLine[] = [];

let observed: Element | null = null;
let observer: MutationObserver | null = null;

function getVideo(): HTMLVideoElement | null {
  return document.querySelector("video");
}

function playVideo(): void {
  void getVideo()?.play();
}

function pauseVideo(): void {
  getVideo()?.pause();
}

function readCaption(container: Element): string {
  // Joined explicitly: textContent glues segments together, and innerText separates them
  // only when their CSS happens to be block-level.
  const segments = container.querySelectorAll(CAPTION_SEGMENT_SELECTOR);
  const text = segments.length
    ? Array.from(segments, (segment) => segment.textContent ?? "").join(" ")
    : (container as HTMLElement).innerText;

  return text.replace(/\s+/g, " ").trim();
}

function record(text: string): void {
  if (!text || buffer[buffer.length - 1]?.text === text) {
    return;
  }

  buffer.push({ text, at: getVideo()?.currentTime ?? 0 });
  if (buffer.length > BUFFER_SIZE) {
    buffer.shift();
  }
}

function observe(container: Element): void {
  observer?.disconnect();
  observed = container;
  observer = new MutationObserver(() => {
    record(readCaption(container));
  });
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  record(readCaption(container));
}

// The container comes and goes with the subtitle toggle and SPA navigation. Polling for
// it beats observing the whole document, which on YouTube fires constantly.
function syncObserver(): void {
  const container = document.querySelector(CAPTION_CONTAINER_SELECTOR);
  if (container && container !== observed) {
    observe(container);
  } else if (!container && observed) {
    observer?.disconnect();
    observer = null;
    observed = null;
  }
}

function watchForCaptionContainer(): void {
  syncObserver();
  setInterval(syncObserver, CONTAINER_POLL_MS);
}

function currentLine(): CaptionLine | null {
  const container = document.querySelector(CAPTION_CONTAINER_SELECTOR);
  const onScreen = container ? readCaption(container) : "";
  if (onScreen) {
    return { text: onScreen, at: getVideo()?.currentTime ?? 0 };
  }

  return buffer[buffer.length - 1] ?? null;
}

function isWorthLookingUp(word: string): boolean {
  return !/\d|[!@#$%^&*(),.?":{}|<>]/.test(word) && word.length >= 2;
}

function closePanel(): void {
  document.getElementById(PANEL_ID)?.remove();
  playVideo();
}

function escKeyHandler(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    closePanel();
  }
}

// Replaced by a real overlay in Phase 5.
function createCustomAlert(): void {
  window.alert = (message: string) => {
    const alertBox = document.createElement("div");
    alertBox.id = "boxAlert";
    alertBox.innerHTML = message;
    alertBox.style.fontFamily = "ColfaxAI, Helvetica, sans-serif";
    alertBox.style.borderRadius = "10px";
    alertBox.style.position = "fixed";
    alertBox.style.top = "10px";
    alertBox.style.right = "10px";
    alertBox.style.width = "auto";
    alertBox.style.maxWidth = "30%";
    alertBox.style.backgroundColor = "#fff";
    alertBox.style.border = "1px solid #f5c6cb";
    alertBox.style.padding = "0.75rem 1.25rem";
    alertBox.style.zIndex = "99999999";
    alertBox.style.fontSize = "14px";

    const buttonDiv = document.createElement("div");
    buttonDiv.style.display = "flex";
    buttonDiv.style.justifyContent = "center";
    buttonDiv.style.marginTop = "0.5rem";

    const closeButton = document.createElement("button");
    closeButton.id = "closeButton";
    closeButton.innerText = "X";
    closeButton.style.width = "25px";
    closeButton.style.height = "25px";
    closeButton.style.backgroundColor = "transparent";
    closeButton.style.border = "none";
    closeButton.style.padding = "0.25rem 0.5rem";
    closeButton.style.marginRight = "0.5rem";

    buttonDiv.appendChild(closeButton);
    alertBox.appendChild(buttonDiv);

    closeButton.addEventListener("click", () => {
      alertBox.remove();
      playVideo();
    });
    document.body.appendChild(alertBox);
  };
}

function createWordButton(word: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = word;
  button.style.backgroundColor = "#d0451b";
  button.style.borderRadius = "10px";
  button.style.border = "1px solid #942911";
  button.style.color = "#ffffff";
  button.style.fontFamily = "Arial";
  button.style.fontSize = "18px";
  button.style.textShadow = "0px 1px 0px #854629";
  button.style.cursor = "pointer";
  button.style.boxShadow = "inset 0px 1px 0px 0px #cf866c";
  button.style.padding = "6px 10px";

  button.addEventListener("click", () => {
    closePanel();
    void fetch(`${SERVER_URL}/?input=${encodeURIComponent(word)}`)
      .then((res) => res.json())
      .then((result: { result: string }) => {
        createCustomAlert();
        alert(result.result);
      });
  });

  return button;
}

function openPanel(line: CaptionLine): void {
  document.getElementById(PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.position = "fixed";
  panel.style.left = "50%";
  panel.style.bottom = "12%";
  panel.style.transform = "translateX(-50%)";
  panel.style.display = "flex";
  panel.style.flexWrap = "wrap";
  panel.style.gap = "8px";
  panel.style.justifyContent = "center";
  panel.style.maxWidth = "80%";
  panel.style.padding = "12px";
  panel.style.borderRadius = "12px";
  panel.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
  panel.style.zIndex = "99999999";

  for (const word of line.text.split(" ")) {
    const cleaned = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (isWorthLookingUp(cleaned)) {
      panel.appendChild(createWordButton(cleaned));
    }
  }

  document.body.appendChild(panel);
}

document.addEventListener("keydown", escKeyHandler);

chrome.runtime.onMessage.addListener((message: LookupMessage) => {
  if (message.type !== "LOOKUP_SUBTITLE") {
    return;
  }

  const line = currentLine();
  if (!line) {
    return;
  }

  pauseVideo();
  openPanel(line);
});

watchForCaptionContainer();
