const SERVER_URL = "http://localhost:3000";

// YouTube only for now; Phase 4 turns this into a per-platform adapter.
const CAPTION_CONTAINER_SELECTOR = ".ytp-caption-window-container";

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

/**
 * The last few subtitle lines, oldest first. The buffer exists because the caption
 * container is emptied between lines: by the time the user reacts to a word, the line
 * they saw may already be gone from the DOM.
 */
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
  // innerText, not textContent: the container holds one span per caption segment and
  // textContent would glue them together without spaces.
  return (container as HTMLElement).innerText.replace(/\s+/g, " ").trim();
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

/**
 * The caption container is created when subtitles are turned on and destroyed on SPA
 * navigation, so it cannot be looked up once at startup. Polling for it every second is
 * cheaper and far less noisy than observing the whole document on a page like YouTube.
 */
function watchForCaptionContainer(): void {
  setInterval(() => {
    const container = document.querySelector(CAPTION_CONTAINER_SELECTOR);
    if (container && container !== observed) {
      observe(container);
    } else if (!container && observed) {
      observer?.disconnect();
      observer = null;
      observed = null;
    }
  }, CONTAINER_POLL_MS);
}

/**
 * The line the user is reacting to: whatever is on screen right now, or the last line
 * that was, if the caption has already been cleared.
 */
function currentLine(): CaptionLine | null {
  const container = document.querySelector(CAPTION_CONTAINER_SELECTOR);
  const onScreen = container ? readCaption(container) : "";
  if (onScreen) {
    return { text: onScreen, at: getVideo()?.currentTime ?? 0 };
  }

  return buffer[buffer.length - 1] ?? null;
}

/**
 * If a word contains a number or a symbol, or is too short, it is not worth looking up.
 */
function filterText(text: string): boolean {
  return /\d|[!@#$%^&*(),.?":{}|<>]/.test(text) || text.length < 2;
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

// Kept as-is from the original until Phase 5 replaces it with a real overlay.
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
    if (filterText(cleaned)) {
      continue;
    }

    panel.appendChild(createWordButton(cleaned));
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
