import type { Rect } from "./caption-source";
import { lookupWord } from "./lookup";
import { panelStyles } from "./panel.css";

const HOST_ID = "vocab-root";
const GAP = 8;
const EDGE = 8;

interface PanelOptions {
  text: string;
  previous?: string | undefined;
  /** Where the caption text sits; the panel takes that spot while open. */
  captionRect: Rect | null;
  /** The caption layer, hidden so the words are not drawn twice. */
  captionElement: HTMLElement | null;
}

let host: HTMLElement | null = null;
let hiddenCaption: HTMLElement | null = null;

function isWorthLookingUp(word: string): boolean {
  return !/\d|[!@#$%^&*(),.?":{}|<>]/.test(word) && word.length >= 2;
}

function strip(word: string): string {
  return word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

/**
 * Below the word when it fits, above it otherwise. The panel usually sits where the
 * subtitle was, near the bottom, so in practice this opens upwards.
 */
function place(meaning: HTMLElement, word: HTMLElement): void {
  const anchor = word.getBoundingClientRect();
  const box = meaning.getBoundingClientRect();

  const below = anchor.bottom + GAP;
  const fitsBelow = below + box.height + EDGE <= window.innerHeight;
  meaning.style.top = `${fitsBelow ? below : anchor.top - box.height - GAP}px`;

  const centred = anchor.left + anchor.width / 2 - box.width / 2;
  const maxLeft = window.innerWidth - box.width - EDGE;
  meaning.style.left = `${Math.max(EDGE, Math.min(centred, maxLeft))}px`;
}

function closeMeaning(root: ShadowRoot): void {
  root.querySelector(".meaning")?.remove();
  root
    .querySelectorAll('.word[aria-expanded="true"]')
    .forEach((word) => word.setAttribute("aria-expanded", "false"));
}

function showMeaning(
  root: ShadowRoot,
  button: HTMLElement,
  word: string,
): void {
  closeMeaning(root);
  button.setAttribute("aria-expanded", "true");

  const meaning = document.createElement("div");
  meaning.className = "meaning pending";
  meaning.id = "vocab-meaning";
  meaning.textContent = `Looking up "${word}"…`;
  root.appendChild(meaning);
  place(meaning, button);

  const render = (body: string): void => {
    meaning.className = "meaning";
    meaning.textContent = "";

    const title = document.createElement("h1");
    title.textContent = word;
    const paragraph = document.createElement("p");
    paragraph.textContent = body;

    meaning.append(title, paragraph);
    place(meaning, button);
  };

  void lookupWord(word)
    .then(render)
    .catch(() => render(`Could not look up "${word}".`));
}

function buildPanel(root: ShadowRoot, options: PanelOptions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "vocab-panel";

  if (options.previous) {
    const previous = document.createElement("div");
    previous.className = "previous";
    previous.textContent = options.previous;
    panel.appendChild(previous);
  }

  const words = document.createElement("div");
  words.className = "words";

  for (const raw of options.text.split(" ")) {
    const word = strip(raw);
    if (!isWorthLookingUp(word)) {
      continue;
    }

    const button = document.createElement("button");
    button.className = "word";
    button.type = "button";
    button.textContent = word;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => showMeaning(root, button, word));
    words.appendChild(button);
  }

  panel.appendChild(words);
  return panel;
}

/** Puts the panel where the caption was, or centred near the bottom if it is gone. */
function position(panel: HTMLElement, rect: Rect | null): void {
  if (!rect || rect.width === 0) {
    panel.style.left = "50%";
    panel.style.bottom = "12%";
    panel.style.transform = "translateX(-50%)";
    return;
  }

  // Grown a little past the caption: chips need more room than plain text.
  const width = Math.min(rect.width * 1.15, window.innerWidth - EDGE * 2);
  const left = rect.left + rect.width / 2 - width / 2;
  const maxLeft = window.innerWidth - width - EDGE;

  panel.style.width = `${width}px`;
  panel.style.left = `${Math.max(EDGE, Math.min(left, maxLeft))}px`;
  panel.style.top = `${rect.top}px`;
}

export function isPanelOpen(): boolean {
  return host !== null;
}

export function closeOverlays(): void {
  if (hiddenCaption) {
    hiddenCaption.style.visibility = "";
    hiddenCaption = null;
  }

  host?.remove();
  host = null;
}

export function openPanel(options: PanelOptions): void {
  closeOverlays();

  host = document.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = panelStyles;
  root.appendChild(style);

  const panel = buildPanel(root, options);
  root.appendChild(panel);
  // In fullscreen the browser only paints descendants of the fullscreen element, so
  // anything appended to document.body would simply not be drawn.
  (document.fullscreenElement ?? document.body).appendChild(host);

  // Hide the real caption only once the panel is standing in for it, so the words never
  // disappear from the screen even for a frame.
  position(panel, options.captionRect);
  if (options.captionElement) {
    hiddenCaption = options.captionElement;
    hiddenCaption.style.visibility = "hidden";
  }
}
