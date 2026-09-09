import { LookupError } from "../../meaning";
import type { Meaning, MeaningProvider } from "../../meaning";

const ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en";
/** "run" alone answers with 63 definitions. Two is what a paused film has room for. */
const MAX_SENSES = 2;

/** Only the fields read here; the API sends a good deal more. */
interface Entry {
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
}

function first<T>(
  entries: Entry[],
  pick: (entry: Entry) => T | undefined,
): T | undefined {
  for (const entry of entries) {
    const value = pick(entry);
    if (value) {
      return value;
    }
  }

  return undefined;
}

/** Free and keyless, but context-free: what the word can mean, never what it means here. */
export const dictionary: MeaningProvider = {
  id: "dictionary",
  usesSentence: false,

  async lookup(word: string): Promise<Meaning> {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new LookupError(
        response.status === 404
          ? `No dictionary entry for "${word}".`
          : `The dictionary answered ${response.status}.`,
      );
    }

    const entries = (await response.json()) as Entry[];
    // One part of speech: the noun and the verb side by side read as one confused entry.
    const group = entries
      .flatMap((entry) => entry.meanings ?? [])
      .find((meaning) => meaning.definitions.length > 0);

    if (!group) {
      throw new LookupError(`No dictionary entry for "${word}".`);
    }

    return {
      senses: group.definitions
        .slice(0, MAX_SENSES)
        .map(({ definition, example }) => ({ definition, example })),
      partOfSpeech: group.partOfSpeech,
      phonetic: first(
        entries,
        (entry) => entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text,
      ),
      audio: first(
        entries,
        (entry) => entry.phonetics?.find((p) => p.audio)?.audio,
      ),
    };
  },
};
