import { readCache, writeCache } from "./cache";
import type { Meaning, MeaningProvider } from "./meaning";
import { dictionary } from "./providers/dictionary";

/** The dictionary answers first; the model is a second step the reader asks for. */
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
