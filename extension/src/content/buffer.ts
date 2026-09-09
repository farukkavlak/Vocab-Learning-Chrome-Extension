import type { CaptionLine } from "./caption-source";

/**
 * Kept because the caption is cleared between lines: by the time the user reacts to a
 * word, the line they saw may already be gone from the DOM.
 */
export class CaptionBuffer {
  private readonly lines: CaptionLine[] = [];

  constructor(private readonly size = 5) {}

  push(line: CaptionLine): void {
    if (this.last?.text === line.text) {
      return;
    }

    this.lines.push(line);
    if (this.lines.length > this.size) {
      this.lines.shift();
    }
  }

  get last(): CaptionLine | null {
    return this.lines[this.lines.length - 1] ?? null;
  }
}
