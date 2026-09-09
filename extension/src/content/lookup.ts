const SERVER_URL = "http://localhost:3000";

export async function lookupWord(word: string): Promise<string> {
  const response = await fetch(
    `${SERVER_URL}/?input=${encodeURIComponent(word)}`,
  );
  const body = (await response.json()) as { result: string };
  return body.result;
}
