import { clamp, EDGE } from "./layout";
import { lookupWord } from "./lookup";
import type { Meaning } from "./meaning";

/** Between the card and the panel it belongs to. */
const GAP = 8;
/** Half the arrow's diagonal, to centre it on the word it points at. */
const ARROW_OFFSET = 5;

/**
 * Below the panel when there is room, above it otherwise — which, since the panel sits
 * where the subtitle was, is most of the time. It clears the whole panel rather than
 * just the clicked word: opening under the word would cover the rest of the sentence,
 * and the sentence is the context the meaning is being read in.
 */
function place(card: HTMLElement, word: HTMLElement, panel: HTMLElement): void {
  const anchor = word.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const line = panel.getBoundingClientRect();

  const below = line.bottom + GAP;
  const fitsBelow = below + box.height + EDGE <= window.innerHeight;
  const top = fitsBelow ? below : line.top - box.height - GAP;
  card.style.top = `${Math.max(EDGE, top)}px`;

  const centre = anchor.left + anchor.width / 2;
  const left = clamp(
    centre - box.width / 2,
    EDGE,
    window.innerWidth - box.width - EDGE,
  );
  card.style.left = `${left}px`;

  // The card is clamped to the window, so it is not always centred on the word. The
  // arrow keeps the link visible by following the word instead of the card.
  const arrow = card.querySelector<HTMLElement>(".arrow");
  if (arrow) {
    arrow.className = `arrow ${fitsBelow ? "below" : "above"}`;
    const x = centre - left - ARROW_OFFSET;
    arrow.style.left = `${clamp(x, 10, box.width - 20)}px`;
  }
}

function badge(text: string, extra?: string): HTMLElement {
  const element = document.createElement("span");
  element.className = extra ? `badge ${extra}` : "badge";
  element.textContent = text;
  return element;
}

function paragraph(className: string, text: string): HTMLElement {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}

function render(card: HTMLElement, word: string, meaning: Meaning): void {
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
    card.append(paragraph("phrase", meaning.phrase));
  }

  card.append(paragraph("body", meaning.meaningInContext));

  if (meaning.translation) {
    card.append(paragraph("translation", meaning.translation));
  }
}

export function isCardOpen(root: ShadowRoot | null | undefined): boolean {
  return root?.querySelector(".meaning") != null;
}

export function closeCard(root: ShadowRoot | null | undefined): void {
  root?.querySelector(".meaning")?.remove();
  root
    ?.querySelectorAll<HTMLElement>('.word[aria-expanded="true"]')
    .forEach((word) => word.setAttribute("aria-expanded", "false"));
}

/** Opens the card in its pending state and fills it in when the lookup answers. */
export function openCard(
  root: ShadowRoot,
  panel: HTMLElement,
  button: HTMLElement,
  word: string,
): void {
  closeCard(root);
  button.setAttribute("aria-expanded", "true");

  const card = document.createElement("div");
  card.className = "meaning pending";
  card.id = "vocab-meaning";
  const arrow = document.createElement("div");
  arrow.className = "arrow";
  card.append(arrow, paragraph("body", `Looking up "${word}"…`));
  root.appendChild(card);
  place(card, button, panel);

  const fill = (meaning: Meaning): void => {
    // The card may have been closed, or another word opened, while the request was out.
    if (!card.isConnected) {
      return;
    }

    render(card, word, meaning);
    place(card, button, panel);
  };

  void lookupWord(word)
    .then(fill)
    .catch(() => fill({ meaningInContext: `Could not look up "${word}".` }));
}
