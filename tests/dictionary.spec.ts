import {
  test,
  expect,
  lookup,
  watchPage,
  entry,
  EXAMPLE,
  MEANING,
} from "./fixture";

const LINE = ["he had to run the department"];

test("answers with the definition, its own example and the pronunciation", async ({
  context,
  worker,
}) => {
  const page = await watchPage(context);
  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();

  const card = page.locator("#vocab-meaning");
  await expect(card.locator(".definition")).toHaveText(MEANING);
  await expect(card.locator(".example")).toHaveText(EXAMPLE);
  await expect(card.locator(".phonetic")).toHaveText("/rʌn/");
  await expect(card.locator(".badge")).toHaveText("verb");
});

test("shows two senses at most", async ({ context, worker }) => {
  // "run" alone comes back with 63 definitions from the real API.
  const page = await watchPage(context, {
    dictionary: entry([
      { definition: "first" },
      { definition: "second" },
      { definition: "third" },
      { definition: "fourth" },
    ]),
  });
  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();

  await expect(page.locator("#vocab-meaning .sense")).toHaveCount(2);
  await expect(page.locator("#vocab-meaning .definition")).toHaveText([
    "first",
    "second",
  ]);
});

test("plays the recording the dictionary hosts", async ({
  context,
  worker,
}) => {
  const page = await watchPage(context);
  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();
  await expect(page.locator("#vocab-meaning .speak")).toBeVisible();

  // Fetched, not set as a src: a remote src would answer to the host page's CSP.
  const request = page.waitForRequest(/\.mp3$/);
  await page.locator("#vocab-meaning .speak").click();
  expect((await request).url()).toContain("run-uk.mp3");
});

test("looks a word up once and then reads it from the cache", async ({
  context,
  worker,
}) => {
  const lookups: string[] = [];
  const page = await watchPage(context, { onLookup: (w) => lookups.push(w) });

  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);

  const word = page.getByRole("button", { name: "run", exact: true });
  await word.click();
  await expect(page.locator("#vocab-meaning .definition")).toHaveText(MEANING);

  await page.keyboard.press("Escape");
  await word.click();
  await expect(page.locator("#vocab-meaning .definition")).toHaveText(MEANING);

  expect(lookups).toHaveLength(1);
});

test("retries when the service is having a bad day", async ({
  context,
  worker,
}) => {
  // 522 from Cloudflare, seen three times from this service while building. A retry
  // costs a moment; a clean error costs the lookup.
  let calls = 0;
  const page = await watchPage(context);
  await context.route("**/entries/en/**", (route) => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 522, body: "error code: 522" })
      : route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(entry()),
        });
  });

  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();

  await expect(page.locator("#vocab-meaning .definition")).toHaveText(MEANING);
  expect(calls).toBe(2);
});

test("says the dictionary is down in words, not in a status code", async ({
  context,
  worker,
}) => {
  const page = await watchPage(context);
  await context.route("**/entries/en/**", (route) =>
    route.fulfill({ status: 522, body: "error code: 522" }),
  );

  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();

  await expect(page.locator("#vocab-meaning")).toContainText(
    "The dictionary is not answering",
  );
  await expect(page.locator("#vocab-meaning")).not.toContainText("522");
});

test("does not retry what the service said on purpose", async ({
  context,
  worker,
}) => {
  // Repeating a rate limit only makes it worse, and delays the reader's answer.
  let calls = 0;
  const page = await watchPage(context);
  await context.route("**/entries/en/**", (route) => {
    calls += 1;
    return route.fulfill({ status: 429, body: "slow down" });
  });

  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();

  // Not just visible: the pending card carries the same class, and asserting on that
  // would read the counter before the request had left.
  await expect(page.locator("#vocab-meaning .definition")).toHaveText(
    "The dictionary is not answering. Try again in a moment.",
  );
  expect(calls).toBe(1);
});

test("says so when the word has no entry", async ({ context, worker }) => {
  const page = await watchPage(context, { dictionary: "missing" });
  await page.evaluate((line) => window.showCaption(line), LINE);
  await lookup(worker);
  await page.getByRole("button", { name: "run", exact: true }).click();

  await expect(page.locator("#vocab-meaning")).toContainText(
    'No dictionary entry for "run".',
  );
});
