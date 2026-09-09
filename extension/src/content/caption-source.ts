export interface CaptionLine {
  text: string;
  at: number;
}

export interface CaptionSource {
  readonly id: string;
  /** URL match patterns for this platform; the manifest is generated from them. */
  readonly hostPatterns: readonly string[];
  matches(url: string): boolean;
  /** Starts reporting caption lines. Returns a detach function. */
  attach(onLine: (line: CaptionLine) => void): () => void;
  /** The caption on screen right now, or "" when none is showing. */
  readCurrent(): string;
  getVideo(): HTMLVideoElement | null;
}
