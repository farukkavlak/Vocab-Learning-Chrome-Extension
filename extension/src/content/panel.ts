import { lookupWord } from "./lookup";

const PANEL_ID = "vocab-container";
const RESULT_ID = "boxAlert";

// Everything below is placeholder chrome carried over from the original extension.
// Phase 5 replaces it with a stylesheet in a shadow root, and Phase 6 replaces the
// lookupWord import with a MeaningProvider passed in from outside.

function isWorthLookingUp(word: string): boolean {
  return !/\d|[!@#$%^&*(),.?":{}|<>]/.test(word) && word.length >= 2;
}

function closePanel(): void {
  document.getElementById(PANEL_ID)?.remove();
}

function showResult(text: string, resumeVideo: () => void): void {
  document.getElementById(RESULT_ID)?.remove();

  const box = document.createElement("div");
  box.id = RESULT_ID;
  box.textContent = text;
  box.style.fontFamily = "Helvetica, sans-serif";
  box.style.borderRadius = "10px";
  box.style.position = "fixed";
  box.style.top = "10px";
  box.style.right = "10px";
  box.style.maxWidth = "30%";
  box.style.backgroundColor = "#fff";
  box.style.border = "1px solid #f5c6cb";
  box.style.padding = "0.75rem 1.25rem";
  box.style.zIndex = "99999999";
  box.style.fontSize = "14px";

  const close = document.createElement("button");
  close.id = "closeButton";
  close.textContent = "X";
  close.style.marginLeft = "0.5rem";
  close.style.background = "transparent";
  close.style.border = "none";
  close.style.cursor = "pointer";
  close.addEventListener("click", () => {
    box.remove();
    resumeVideo();
  });

  box.appendChild(close);
  document.body.appendChild(box);
}

function createWordButton(
  word: string,
  resumeVideo: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = word;
  button.style.backgroundColor = "#d0451b";
  button.style.borderRadius = "10px";
  button.style.border = "1px solid #942911";
  button.style.color = "#ffffff";
  button.style.fontFamily = "Arial";
  button.style.fontSize = "18px";
  button.style.cursor = "pointer";
  button.style.padding = "6px 10px";

  button.addEventListener("click", () => {
    closePanel();
    void lookupWord(word)
      .then((meaning) => showResult(meaning, resumeVideo))
      .catch(() => showResult(`Could not look up "${word}".`, resumeVideo));
  });

  return button;
}

/** Removes the word bar and any result box, without touching playback. */
export function closeOverlays(): void {
  closePanel();
  document.getElementById(RESULT_ID)?.remove();
}

export function openPanel(text: string, resumeVideo: () => void): void {
  closePanel();

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

  for (const word of text.split(" ")) {
    const cleaned = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (isWorthLookingUp(cleaned)) {
      panel.appendChild(createWordButton(cleaned, resumeVideo));
    }
  }

  document.body.appendChild(panel);
}
