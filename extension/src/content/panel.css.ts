// Lives in a shadow root, so these rules cannot leak out and the host page's cannot
// leak in. Kept as a string because a content script has no stylesheet loader.
export const panelStyles = `
  :host {
    all: initial;
  }

  .panel {
    position: fixed;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(15, 15, 17, 0.92);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    z-index: 2147483647;
  }

  .previous {
    color: rgba(255, 255, 255, 0.45);
    font-size: 15px;
    line-height: 1.3;
    text-align: center;
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .word {
    padding: 3px 8px;
    border: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font: inherit;
    font-size: 19px;
    line-height: 1.3;
    cursor: pointer;
  }

  .word:hover,
  .word:focus-visible {
    background: #d0451b;
    outline: none;
  }

  .word[aria-expanded="true"] {
    background: #d0451b;
  }

  .meaning {
    position: fixed;
    box-sizing: border-box;
    max-width: 340px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #fff;
    color: #16161a;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 2147483647;
  }

  .meaning h1 {
    margin: 0 0 4px;
    font-size: 15px;
  }

  .meaning p {
    margin: 0;
  }

  .meaning.pending {
    color: #6b6b76;
  }
`;
