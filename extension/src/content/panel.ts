import type { Rect } from "./caption-source";
import { clamp, EDGE } from "./layout";
import { closeCard, isCardOpen, openCard } from "./meaning-card";
import { panelStyles } from "./panel.css";

const HOST_ID = "vocab-root";
/** The panel never spans the full window: a caption never does either. */
const MAX_WIDTH_RATIO = 0.92;
/** `.word` horizontal padding, in em, doubled for the two sides. */
const WORD_PADDING_EM = 0.16;
/** `.panel` horizontal padding, both sides. */
const PANEL_PADDING = 28;
/** First guess at the panel's position, before the line itself is measured. */
const BASELINE_OFFSET = 10;
/** Narrower than this and the card under it has nothing to line up with. */
const MIN_WIDTH = 320;

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

/** Left and right walk the line; the browser handles Enter and Space on a button. */
function focusWord(
  root: ShadowRoot,
  from: HTMLElement | null,
  step: number,
): void {
  const words = [...root.querySelectorAll<HTMLElement>(".word")];
  const next = from
    ? words[words.indexOf(from) + step]
    : words[step > 0 ? 0 : words.length - 1];
  next?.focus();
}

/**
 * Every token is rendered, so the line still reads as the sentence it stands in for.
 * Only the words worth a lookup become buttons; punctuation, numbers and one-letter
 * words stay as plain text.
 */
function buildLine(
  root: ShadowRoot,
  panel: HTMLElement,
  text: string,
): HTMLElement {
  const line = document.createElement("div");
  line.className = "line";

  for (const token of text.split(/(\s+)/)) {
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
    button.addEventListener("click", () => openCard(root, panel, button, word));
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        focusWord(root, button, event.key === "ArrowRight" ? 1 : -1);
      }
    });
    line.appendChild(button);
  }

  return line;
}

function buildPanel(root: ShadowRoot, options: PanelOptions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "vocab-panel";
  // Focusable so the arrow keys reach the line without tabbing into the shadow root.
  panel.tabIndex = -1;
  panel.addEventListener("keydown", (event) => {
    if (event.target !== panel) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusWord(root, null, event.key === "ArrowRight" ? 1 : -1);
    }
  });

  if (options.previous) {
    const previous = document.createElement("div");
    previous.className = "previous";
    previous.textContent = options.previous;
    panel.appendChild(previous);
  }

  panel.appendChild(buildLine(root, panel, options.text));

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Esc to resume";
  panel.appendChild(hint);

  return panel;
}

/**
 * How wide the line may run before it wraps. A single-line caption should stay a single
 * line, and the panel needs exactly as much extra room as its decoration takes — the
 * hover padding on each word plus its own padding, which follows the word count, not
 * the caption's width. Past that it wraps where the caption's own line did, so a caption
 * the player broke in two does not become one window-wide line.
 */
function widthFor(panel: HTMLElement, rect: Rect): number {
  const ceiling = window.innerWidth * MAX_WIDTH_RATIO;
  panel.style.maxWidth = `${ceiling}px`;
  const natural = panel.getBoundingClientRect().width;

  const fontSize = parseFloat(getComputedStyle(panel).fontSize) || 16;
  const words = panel.querySelectorAll(".word").length;
  const decoration = words * WORD_PADDING_EM * fontSize + PANEL_PADDING;

  return Math.min(
    natural,
    ceiling,
    Math.max(rect.width + decoration, MIN_WIDTH),
  );
}

/**
 * Puts the panel where the caption was, or centred near the bottom if it is gone.
 * What has to stay put is the words, not the box around them: the previous line and the
 * hint sit outside the caption's own place, and the panel is taller than the caption it
 * replaces, so growing downwards from the caption's top would run it off the screen.
 */
function position(panel: HTMLElement, rect: Rect | null): void {
  if (!rect || rect.width === 0) {
    panel.style.left = "50%";
    panel.style.bottom = "12%";
    panel.style.transform = "translateX(-50%)";
    return;
  }

  panel.style.maxWidth = `${widthFor(panel, rect)}px`;

  const box = panel.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - box.width / 2;
  panel.style.left = `${clamp(left, EDGE, window.innerWidth - box.width - EDGE)}px`;

  const maxTop = window.innerHeight - box.height - EDGE;
  let top = clamp(
    rect.top + rect.height + BASELINE_OFFSET - box.height,
    EDGE,
    maxTop,
  );
  panel.style.top = `${top}px`;

  // Line the words up on a second pass, now that the panel has been laid out and the
  // line's own position can be measured. Centres rather than edges: the panel's line box
  // and the caption's are not the same height, so only their middles are comparable.
  const line = panel.querySelector(".line")?.getBoundingClientRect();
  if (line) {
    const captionCentre = rect.top + rect.height / 2;
    top = clamp(
      top + (captionCentre - (line.top + line.height / 2)),
      EDGE,
      maxTop,
    );
    panel.style.top = `${top}px`;
  }
}

/** Matched to the caption, so the panel reads as the subtitle at any player size. */
function scaleTo(captionFontSize: number): void {
  host?.style.setProperty("--size", `${captionFontSize}px`);
  // Bounded: the card is prose, and prose set at caption size is unreadable in
  // fullscreen and too small in a tiny window.
  host?.style.setProperty(
    "--meaning-size",
    `${clamp(captionFontSize * 0.7, 13, 18)}px`,
  );
}

export function isPanelOpen(): boolean {
  return host !== null;
}

/** True when the event happened inside the panel, which owns a shadow root. */
export function isInsidePanel(target: EventTarget | null): boolean {
  return target instanceof Node && host !== null && host.contains(target);
}

export function isMeaningOpen(): boolean {
  return isCardOpen(host?.shadowRoot);
}

export function closeMeaning(): void {
  closeCard(host?.shadowRoot);
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
    scaleTo(options.captionFontSize);
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
