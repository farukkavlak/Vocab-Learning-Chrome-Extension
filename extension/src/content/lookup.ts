import type { Meaning } from "./meaning";

const SERVER_URL = "http://localhost:3000";

/**
 * The 2023 server answers with a bare string. The provider rewrite answers with the
 * whole `Meaning`, and the card already lays every field out, so both shapes are
 * accepted here rather than holding the panel back until then.
 */
export async function lookupWord(word: string): Promise<Meaning> {
  const response = await fetch(
    `${SERVER_URL}/?input=${encodeURIComponent(word)}`,
  );
  const body = (await response.json()) as Partial<Meaning> & {
    result?: string;
  };

  return {
    ...body,
    meaningInContext: body.meaningInContext ?? body.result ?? "",
  };
}
