import { llmProvider } from "./llm";

interface Response {
  content?: { type: string; text?: string }[];
}

export const anthropic = llmProvider({
  id: "anthropic",
  keyUrl: "https://console.anthropic.com/settings/keys",
  label: "Claude",
  // Cheapest and fastest of the family: a subtitle word is a small question.
  model: "claude-haiku-4-5",
  endpoint: "https://api.anthropic.com/v1/messages",
  // The worker's requests carry the extension's host permissions, so Anthropic's
  // direct-browser-access opt-in is not needed here.
  headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  body: (text, model, schema) => ({
    model,
    max_tokens: 512,
    messages: [{ role: "user", content: text }],
    output_config: { format: { type: "json_schema", schema } },
  }),
  extract: (payload) =>
    (payload as Response).content?.find((block) => block.type === "text")?.text,
});
