import { LookupError } from "../../meaning";
import type { Cacheable, Meaning } from "../../meaning";

/** The answer the model is asked for, and the shape every adapter constrains it to. */
const SCHEMA = {
  type: "object",
  properties: {
    definition: { type: "string" },
    partOfSpeech: { type: "string" },
    cefr: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
    phrase: { type: "string" },
  },
  required: ["definition", "partOfSpeech", "cefr", "phrase"],
  additionalProperties: false,
} as const;

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/**
 * The schema constrains the answer, but a truncated reply is still valid JSON and a
 * missing field would otherwise reach the card as the string "undefined".
 */
function read(text: string, label: string): Meaning {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new LookupError(`${label} answered with something that is not JSON.`);
  }

  const answer = value as Record<string, unknown>;
  if (typeof answer.definition !== "string" || !answer.definition) {
    throw new LookupError(`${label} answered without a definition.`);
  }

  const cefr = LEVELS.find((level) => level === answer.cefr);
  return {
    senses: [{ definition: answer.definition }],
    ...(typeof answer.partOfSpeech === "string" && answer.partOfSpeech
      ? { partOfSpeech: answer.partOfSpeech }
      : {}),
    ...(cefr ? { cefr } : {}),
    ...(typeof answer.phrase === "string" && answer.phrase
      ? { phrase: answer.phrase }
      : {}),
  };
}

/** Both providers report their own failures the same way. */
function reason(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    return typeof message === "string" ? message.slice(0, 120) : undefined;
  } catch {
    return undefined;
  }
}

function prompt(word: string, sentence: string): string {
  return [
    `In the subtitle line "${sentence}", what does "${word}" mean?`,
    "Define it as it is used in that line, in one sentence of plain English,",
    "for someone learning English who is staying inside English.",
    'If the word belongs to a phrasal verb or idiom, set "phrase" to that whole',
    'expression; otherwise set it to "". Do not translate.',
  ].join(" ");
}

export interface LlmConfig {
  id: string;
  /** Shown in the settings page and on the card. */
  label: string;
  model: string;
  endpoint: string;
  headers(key: string): Record<string, string>;
  body(text: string, model: string, schema: typeof SCHEMA): unknown;
  /** The JSON document the model produced, still as text. */
  extract(payload: unknown): string | undefined;
}

export interface LlmProvider extends Cacheable {
  lookup(word: string, sentence: string, key: string): Promise<Meaning>;
}

/**
 * Every provider is the same request in different clothes: post JSON with a key,
 * constrain the answer to SCHEMA, read one string back out. Adding one is a file of
 * its own plus a line in the registry.
 */
export function llmProvider(config: LlmConfig): LlmProvider {
  return {
    id: config.id,
    usesSentence: true,

    async lookup(word: string, sentence: string, key: string) {
      if (!key) {
        throw new LookupError(`Add a ${config.label} key in the settings.`);
      }

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...config.headers(key) },
        body: JSON.stringify(
          config.body(prompt(word, sentence), config.model, SCHEMA),
        ),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new LookupError(`${config.label} rejected the key.`);
        }

        const said = reason(await response.text());
        throw new LookupError(
          said
            ? `${config.label}: ${said}`
            : `${config.label} answered ${response.status}.`,
        );
      }

      const text = config.extract(await response.json());
      if (!text) {
        throw new LookupError(`${config.label} answered with nothing.`);
      }

      return read(text, config.label);
    },
  };
}
