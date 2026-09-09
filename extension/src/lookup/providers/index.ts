import { anthropic } from "./anthropic";
import type { LlmProvider } from "./llm";
import { openai } from "./openai";

/**
 * Adding a provider is a new file here plus one line in this list. Unlike a caption
 * source, which recognises its own page, the reader chooses this one: whichever key
 * they have.
 */
export const llmProviders: readonly LlmProvider[] = [anthropic, openai];

export function providerFor(id: string): LlmProvider | undefined {
  return llmProviders.find((provider) => provider.id === id);
}
