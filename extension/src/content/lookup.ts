import { LookupError } from "../meaning";
import type { Meaning } from "../meaning";
import type { LookupResult } from "../messages";

async function ask(
  type: "LOOKUP_WORD" | "EXPLAIN_WORD",
  word: string,
  sentence: string,
): Promise<Meaning> {
  const result: LookupResult | undefined = await chrome.runtime.sendMessage({
    type,
    word,
    sentence,
  });

  if (!result?.ok) {
    throw result?.message
      ? new LookupError(result.message)
      : new Error(`Lookup failed for "${word}".`);
  }

  return result.meaning;
}

export const lookupWord = (word: string, sentence: string): Promise<Meaning> =>
  ask("LOOKUP_WORD", word, sentence);

export const explainWord = (word: string, sentence: string): Promise<Meaning> =>
  ask("EXPLAIN_WORD", word, sentence);

/** False when no key has been entered, so the card can leave the step out. */
export async function modelReady(): Promise<boolean> {
  const ready: unknown = await chrome.runtime.sendMessage({
    type: "MODEL_READY",
  });
  return ready === true;
}
