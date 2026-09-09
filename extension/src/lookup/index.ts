import { LookupError } from "../meaning";
import type { Meaning, MeaningProvider } from "../meaning";
import { readCache, writeCache } from "./cache";
import { dictionary } from "./providers/dictionary";
import { configured } from "./settings";

const provider: MeaningProvider = dictionary;

export async function lookupWord(
  word: string,
  sentence: string,
): Promise<Meaning> {
  const cached = await readCache(provider, word, sentence);
  if (cached) {
    return cached;
  }

  const meaning = await provider.lookup(word, sentence);
  await writeCache(provider, word, sentence, meaning);
  return meaning;
}

/** The second step: what the word means in this line, which no dictionary can answer. */
export async function explainWord(
  word: string,
  sentence: string,
): Promise<Meaning> {
  const model = await configured();
  if (!model) {
    throw new LookupError("Add a model key in the extension's settings.");
  }

  const cached = await readCache(model.provider, word, sentence);
  if (cached) {
    return cached;
  }

  const meaning = await model.provider.lookup(word, sentence, model.key);
  await writeCache(model.provider, word, sentence, meaning);
  return meaning;
}
