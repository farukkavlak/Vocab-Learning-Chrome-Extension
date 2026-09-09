import type { Meaning } from "./meaning";

export interface LookupSubtitle {
  type: "LOOKUP_SUBTITLE";
}

export interface LookupWord {
  type: "LOOKUP_WORD";
  word: string;
  sentence: string;
}

/** The same word, asked of the model with the line it appeared in. */
export interface ExplainWord {
  type: "EXPLAIN_WORD";
  word: string;
  sentence: string;
}

/** Whether a model key has been entered, which decides if the card offers the step. */
export interface ModelReady {
  type: "MODEL_READY";
}

export type Message = LookupSubtitle | LookupWord | ExplainWord | ModelReady;

/** `message` is set only when it was written for the reader; see `LookupError`. */
export type LookupResult =
  { ok: true; meaning: Meaning } | { ok: false; message?: string };
