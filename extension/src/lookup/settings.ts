import type { LlmProvider } from "./providers/llm";
import { llmProviders, providerFor } from "./providers";

const CHOSEN = "provider";
const keyName = (id: string): string => `key ${id}`;

export interface Configured {
  provider: LlmProvider;
  key: string;
}

/**
 * Keys live in `storage.local` rather than `storage.sync`, which would carry them to
 * Google's servers, and they are read here in the worker so they never reach a script
 * sharing a page with the site.
 */
export async function configured(): Promise<Configured | null> {
  const names = llmProviders.map((provider) => keyName(provider.id));
  const stored: Record<string, unknown> = await chrome.storage.local.get([
    CHOSEN,
    ...names,
  ]);

  // A reader who has pasted one key has already chosen; asking them to pick as well
  // would be asking twice.
  const preference = stored[CHOSEN];
  const chosen =
    typeof preference === "string" ? providerFor(preference) : undefined;
  for (const provider of chosen ? [chosen] : llmProviders) {
    const key = stored[keyName(provider.id)];
    if (typeof key === "string" && key) {
      return { provider, key };
    }
  }

  return null;
}
