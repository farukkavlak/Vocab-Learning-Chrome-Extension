/**
 * What the panel renders. The fields beyond `meaningInContext` are optional until the
 * provider rewrite fills them in; the card lays them out already so that phase only
 * has to supply data.
 */
export interface Meaning {
  meaningInContext: string;
  translation?: string;
  partOfSpeech?: string;
  cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  /** Set when the word belongs to an idiom or phrasal verb. */
  phrase?: string;
}
