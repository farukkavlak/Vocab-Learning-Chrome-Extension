import type { CaptionSource } from "../caption-source";
import { netflix } from "./netflix";
import { youtube } from "./youtube";

/**
 * Adding a platform is a new file here plus one line in this list.
 *
 * The build imports this module to generate the manifest, so adapters must not touch
 * the DOM while loading — only inside the methods they return.
 */
export const sources: readonly CaptionSource[] = [youtube, netflix];

export function sourceFor(url: string): CaptionSource | null {
  return sources.find((source) => source.matches(url)) ?? null;
}
