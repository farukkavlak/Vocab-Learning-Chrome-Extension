import type { Rect } from "./caption-source";
import { lookupWord } from "./lookup";
import type { Meaning } from "./meaning";
import { panelStyles } from "./panel.css";

const HOST_ID = "vocab-root";
const GAP = 8;
const EDGE = 8;
/** The panel never spans the full window: a caption never does either. */
const MAX_WIDTH_RATIO = 0.92;
/** `.word` horizontal padding, in em, doubled for the two sides. */
const WORD_PADDING_EM = 0.16;
/** First guess at the panel's position, before the line itself is measured. */
const BASELINE_OFFSET = 10;

interface PanelOptions {
  text: string;
  previous?: string | undefined;
  /** Where the caption text sits; the panel takes that spot while open. */
  captionRect: Rect | null;
  /** The caption layer, hidden so the words are not drawn twice. */
  captionElement: HTMLElement | null;
  /** The caption's own font size, matched so the panel reads as the subtitle. */
  captionFontSize: number | null;
}

let host: HTMLElement | null = null;
let hiddenCaption: HTMLElement | null = null;

function isWorthLookingUp(word: string): boolean {
  return !/\d/.test(word) && word.length >= 2;
}

function strip(word: string): string {
  return word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

/**
 * Below the word when it fits, above it otherwise. The panel usually sits where the
 * subtitle was, near the bottom, so in practice this opens upwards.
 */
function place(
  meaning: HTMLElement,
  word: HTMLElement,
  panel: HTMLElement,
): void {
  const anchor = word.getBoundingClientRect();
  const box = meaning.getBoundingClientRect();
  // Vertically the card clears the whole panel, not just the word: opening it right
  // under the word would cover the rest of the sentence, which is what it explains.
  const line = panel.getBoundingClientRect();

  const below = line.bottom + GAP;
  const fitsBelow = below + box.height + EDGE <= window.innerHeight;
  const top = fitsBelow ? below : line.top - box.height - GAP;
  meaning.style.top = `${Math.max(EDGE, top)}px`;

  const centred = anchor.left + anchor.width / 2 - box.width / 2;
  const maxLeft = window.innerWidth - box.width - EDGE;
  const left = Math.max(EDGE, Math.min(centred, maxLeft));
  meaning.style.left = `${left}px`;

  // The card is clamped to the viewport, so it is not always centred on the word.
  // The arrow keeps the link visible by following the word instead of the card.
  const arrow = meaning.querySelector<HTMLElement>(".arrow");
  if (arrow) {
    arrow.className = `arrow ${fitsBelow ? "below" : "above"}`;
    const centre = anchor.left + anchor.width / 2 - left - 5;
    arrow.style.left = `${Math.max(10, Math.min(centre, box.width - 20))}px`;
  }
}

export function isMeaningOpen(): boolean {
  return host?.shadowRoot?.querySelector(".meaning") != null;
}

export function closeMeaning(): void {
  const root = host?.shadowRoot;
  if (!root) {
    return;
  }

  root.querySelector(".meaning")?.remove();
  root
    .querySelectorAll<HTMLElement>('.word[aria-expanded="true"]')
    .forEach((word) => word.setAttribute("aria-expanded", "false"));
}

function badge(text: string, extra?: string): HTMLElement {
  const element = document.createElement("span");
  element.className = extra ? `badge ${extra}` : "badge";
  element.textContent = text;
  return element;
}

function renderMeaning(
  card: HTMLElement,
  word: string,
  meaning: Meaning,
): void {
  card.className = "meaning";
  card.textContent = "";

  const arrow = document.createElement("div");
  arrow.className = "arrow";

  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("h1");
  title.textContent = word;
  head.append(title);
  if (meaning.partOfSpeech) {
    head.append(badge(meaning.partOfSpeech));
  }
  if (meaning.cefr) {
    head.append(badge(meaning.cefr, "cefr"));
  }

  card.append(arrow, head);

  if (meaning.phrase) {
    const phrase = document.createElement("p");
    phrase.className = "phrase";
    phrase.textContent = meaning.phrase;
    card.append(phrase);
  }

  const body = document.createElement("p");
  body.className = "body";
  body.textContent = meaning.meaningInContext;
  card.append(body);

  if (meaning.translation) {
    const translation = document.createElement("p");
    translation.className = "translation";
    translation.textContent = meaning.translation;
    card.append(translation);
  }
}

function showMeaning(
  root: ShadowRoot,
  panel: HTMLElement,
  button: HTMLElement,
  word: string,
): void {
  closeMeaning();
  button.setAttribute("aria-expanded", "true");

  const card = document.createElement("div");
  card.className = "meaning pending";
  card.id = "vocab-meaning";
  const arrow = document.createElement("div");
  arrow.className = "arrow";
  const pending = document.createElement("p");
  pending.className = "body";
  pending.textContent = `Looking up "${word}"…`;
  card.append(arrow, pending);
  root.appendChild(card);
  place(card, button, panel);

  const render = (meaning: Meaning): void => {
    // The card may have been closed, or another word opened, while the request was out.
    if (!card.isConnected) {
      return;
    }

    renderMeaning(card, word, meaning);
    place(card, button, panel);
  };

  void lookupWord(word)
    .then(render)
    .catch(() => render({ meaningInContext: `Could not look up "${word}".` }));
}

/** Left and right walk the line; the browser handles Enter and Space on a button. */
function moveFocus(root: ShadowRoot, from: HTMLElement, step: number): void {
  const words = [...root.querySelectorAll<HTMLElement>(".word")];
  const next = words[words.indexOf(from) + step];
  next?.focus();
}

function buildPanel(root: ShadowRoot, options: PanelOptions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "vocab-panel";
  panel.tabIndex = -1;
  panel.addEventListener("keydown", (event) => {
    if (event.target !== panel) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const words = [...root.querySelectorAll<HTMLElement>(".word")];
      (event.key === "ArrowRight"
        ? words[0]
        : words[words.length - 1]
      )?.focus();
    }
  });

  if (options.previous) {
    const previous = document.createElement("div");
    previous.className = "previous";
    previous.textContent = options.previous;
    panel.appendChild(previous);
  }

  const line = document.createElement("div");
  line.className = "line";

  // Every token is rendered so the line still reads as the sentence it was; only the
  // ones worth a lookup become buttons.
  const tokens = options.text.split(/(\s+)/);
  for (const token of tokens) {
    const word = strip(token);
    if (!word || !isWorthLookingUp(word)) {
      const filler = document.createElement("span");
      filler.className = "filler";
      filler.textContent = token;
      line.appendChild(filler);
      continue;
    }

    const button = document.createElement("button");
    button.className = "word";
    button.type = "button";
    // The raw token, so punctuation stays in the sentence; the lookup uses the word.
    button.textContent = token;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () =>
      showMeaning(root, panel, button, word),
    );
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        moveFocus(root, button, event.key === "ArrowRight" ? 1 : -1);
      }
    });
    line.appendChild(button);
  }

  panel.appendChild(line);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Esc to resume";
  panel.appendChild(hint);

  return panel;
}

/**
 * Puts the panel where the caption was, or centred near the bottom if it is gone.
 * Anchored by its bottom edge: the panel is taller than the caption it replaces, and
 * captions sit close to the bottom of the screen, so growing downwards would push it
 * off-screen.
 */
function position(panel: HTMLElement, rect: Rect | null): void {
  if (!rect || rect.width === 0) {
    panel.style.left = "50%";
    panel.style.bottom = "12%";
    panel.style.transform = "translateX(-50%)";
    return;
  }

  // A single-line caption should stay a single line: the panel needs exactly as much
  // extra room as its decoration takes, which is the hover padding on each word plus
  // its own padding — a function of how many words there are, not of how wide the
  // caption is. Past that the line wraps where the caption's did, so a caption the
  // player broke in two does not become one window-wide line.
  const ceiling = window.innerWidth * MAX_WIDTH_RATIO;
  panel.style.maxWidth = `${ceiling}px`;
  const natural = panel.getBoundingClientRect().width;

  const fontSize = parseFloat(getComputedStyle(panel).fontSize) || 16;
  const words = panel.querySelectorAll(".word").length;
  const decoration = words * WORD_PADDING_EM * fontSize + 28;
  const allowed = Math.min(ceiling, Math.max(rect.width + decoration, 320));
  panel.style.maxWidth = `${Math.min(natural, allowed)}px`;

  const box = panel.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - box.width / 2;
  const maxLeft = window.innerWidth - box.width - EDGE;
  panel.style.left = `${Math.max(EDGE, Math.min(left, maxLeft))}px`;

  const maxTop = window.innerHeight - box.height - EDGE;
  const clamp = (top: number): number => Math.max(EDGE, Math.min(top, maxTop));
  let top = clamp(rect.top + rect.height + BASELINE_OFFSET - box.height);
  panel.style.top = `${top}px`;

  // What has to stay put is the words, not the box around them: the previous line and
  // the hint sit outside the caption's own place. Line them up on a second pass, now
  // that the panel has been laid out and the line's position can be measured. Centres
  // rather than edges, because the panel's line box and the caption's are not the same
  // height — only their middles are comparable.
  const line = panel.querySelector(".line")?.getBoundingClientRect();
  if (line) {
    const captionCentre = rect.top + rect.height / 2;
    top = clamp(top + (captionCentre - (line.top + line.height / 2)));
    panel.style.top = `${top}px`;
  }
}

export function isPanelOpen(): boolean {
  return host !== null;
}

/** True when the event happened inside the panel, which owns a shadow root. */
export function isInsidePanel(target: EventTarget | null): boolean {
  return target instanceof Node && host !== null && host.contains(target);
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

  if (options.captionFontSize) {
    host.style.setProperty("--size", `${options.captionFontSize}px`);
    // Bounded: the card is prose, and prose set at caption size is unreadable in
    // fullscreen and too small in a tiny window.
    const meaningSize = Math.min(
      18,
      Math.max(13, options.captionFontSize * 0.7),
    );
    host.style.setProperty("--meaning-size", `${meaningSize}px`);
  }

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

  // Focus the panel rather than a word: focusing one would mark an arbitrary word as if
  // it were selected. The arrow keys step from here into the line.
  panel.focus();
}
