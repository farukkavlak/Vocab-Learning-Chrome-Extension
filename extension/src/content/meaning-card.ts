import { clamp, EDGE } from "./layout";
import { explainWord, lookupWord, modelReady } from "./lookup";
import { LookupError } from "../meaning";
import type { Meaning } from "../meaning";

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

/** Fetched, not set as a src: a remote src answers to the host page's CSP, ours does not. */
async function speak(url: string): Promise<void> {
  const response = await fetch(url);
  const objectUrl = URL.createObjectURL(await response.blob());
  const audio = new Audio(objectUrl);
  audio.addEventListener("ended", () => URL.revokeObjectURL(objectUrl));
  await audio.play();
}

function speaker(url: string): HTMLElement {
  const button = document.createElement("button");
  button.className = "speak";
  button.type = "button";
  button.title = "Play pronunciation";
  button.setAttribute("aria-label", "Play pronunciation");
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>' +
    '<path d="M16 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round"/></svg>';
  button.addEventListener("click", () => {
    void speak(url).catch(() => button.classList.add("unavailable"));
  });
  return button;
}

function head(word: string, meaning: Meaning): HTMLElement {
  const element = document.createElement("div");
  element.className = "head";

  const title = document.createElement("h1");
  title.textContent = word;
  element.append(title);

  if (meaning.phonetic) {
    const phonetic = document.createElement("span");
    phonetic.className = "phonetic";
    phonetic.textContent = meaning.phonetic;
    element.append(phonetic);
  }

  if (meaning.audio) {
    element.append(speaker(meaning.audio));
  }

  if (meaning.partOfSpeech) {
    element.append(badge(meaning.partOfSpeech));
  }

  if (meaning.cefr) {
    element.append(badge(meaning.cefr, "cefr"));
  }

  return element;
}

/** The dictionary says what the word can mean; this asks what it means here. */
function inSentence(onPress: () => void): HTMLElement {
  const button = document.createElement("button");
  button.className = "ask";
  button.type = "button";
  button.textContent = "In this sentence →";
  button.addEventListener("click", () => {
    // A model call takes seconds; a button that still looks live but does nothing is
    // worse than one that says what it is doing.
    button.disabled = true;
    button.textContent = "Asking…";
    onPress();
  });
  return button;
}

function render(
  card: HTMLElement,
  word: string,
  meaning: Meaning,
  ask?: () => void,
  note?: string,
): void {
  card.className = "meaning";
  card.textContent = "";

  const arrow = document.createElement("div");
  arrow.className = "arrow";
  card.append(arrow, head(word, meaning));

  if (meaning.phrase) {
    card.append(paragraph("phrase", meaning.phrase));
  }

  for (const sense of meaning.senses) {
    const element = document.createElement("div");
    element.className = "sense";
    element.append(paragraph("definition", sense.definition));
    if (sense.example) {
      element.append(paragraph("example", sense.example));
    }
    card.append(element);
  }

  if (meaning.translation) {
    card.append(paragraph("translation", meaning.translation));
  }

  if (note) {
    card.append(paragraph("note", note));
  }

  if (ask) {
    card.append(inSentence(ask));
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
  sentence: string,
): void {
  closeCard(root);
  button.setAttribute("aria-expanded", "true");

  const card = document.createElement("div");
  card.className = "meaning pending";
  card.id = "vocab-meaning";
  const arrow = document.createElement("div");
  arrow.className = "arrow";
  card.append(arrow, paragraph("definition", `Looking up "${word}"…`));
  root.appendChild(card);
  place(card, button, panel);
  card.classList.add("appear");

  const fill = (meaning: Meaning, ask?: () => void, note?: string): void => {
    // Closed, or another word opened, while the request was out.
    if (!card.isConnected) {
      return;
    }

    card.classList.remove("appear");
    render(card, word, meaning, ask, note);
    place(card, button, panel);
    card.classList.add("appear");
  };

  const said = (error: unknown): string =>
    error instanceof LookupError
      ? error.message
      : `Could not look up "${word}".`;

  // The model replaces the senses, not the pronunciation: it has none to give, and the
  // reader should not lose what the dictionary already showed them — which holds when it
  // fails too, so the answer stays on screen with the reason under it.
  const explain = (dictionary: Meaning | null) => (): void => {
    const spoken = {
      phonetic: dictionary?.phonetic,
      audio: dictionary?.audio,
    };

    void explainWord(word, sentence)
      .then((meaning) => fill({ ...meaning, ...spoken }))
      .catch((error: unknown) =>
        dictionary
          ? fill(dictionary, explain(dictionary), said(error))
          : fill({ senses: [{ definition: said(error) }] }, explain(null)),
      );
  };

  // Asked in parallel: the dictionary call is the slow one, and a button that leads
  // nowhere should not be drawn at all.
  const ready = modelReady();

  void lookupWord(word, sentence)
    .then(async (meaning) =>
      fill(meaning, (await ready) ? explain(meaning) : undefined),
    )
    .catch(async (error: unknown) =>
      fill(
        { senses: [{ definition: said(error) }] },
        (await ready) ? explain(null) : undefined,
      ),
    );
}
