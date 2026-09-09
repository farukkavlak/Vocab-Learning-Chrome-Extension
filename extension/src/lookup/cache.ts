import type { Cacheable, Meaning } from "../meaning";

const PREFIX = "meaning";

function key(provider: Cacheable, word: string, sentence: string): string {
  const parts = [PREFIX, provider.id, word.toLowerCase()];
  if (provider.usesSentence) {
    parts.push(sentence);
  }

  return parts.join(" ");
}

// A cache that cannot be read or written makes the extension slower, not broken, so
// both sides swallow their failures.

export async function readCache(
  provider: Cacheable,
  word: string,
  sentence: string,
): Promise<Meaning | null> {
  const id = key(provider, word, sentence);
  try {
    const stored = await chrome.storage.local.get(id);
    return (stored[id] as Meaning | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeCache(
  provider: Cacheable,
  word: string,
  sentence: string,
  meaning: Meaning,
): Promise<void> {
  try {
    await chrome.storage.local.set({
      [key(provider, word, sentence)]: meaning,
    });
  } catch {
    // Out of quota. The answer was still delivered.
  }
}
