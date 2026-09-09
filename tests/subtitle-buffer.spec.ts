import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test, expect, lookup } from "./fixture";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  resolve(here, "fixtures/youtube.html"),
  "utf8",
);

const WATCH_URL = "https://www.youtube.com/watch?v=test";

test.beforeEach(async ({ context }) => {
  // Serve our own page under a youtube.com URL so the manifest's match pattern still
  // applies and the content script is injected exactly as it would be in production.
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixtureHtml }),
  );
});

test("shows the words of the caption that is on screen, and pauses the video", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() => window.player.play());
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);

  await page.evaluate(() =>
    window.showCaption(["He had to run the whole department"]),
  );
  await lookup(worker);

  const words = page.locator("#vocab-panel .word");
  await expect(words).toHaveText([
    "He",
    "had",
    "to",
    "run",
    "the",
    "whole",
    "department",
  ]);
  expect(await page.evaluate(() => window.player.paused)).toBe(true);
});

test("falls back to the last buffered line when the caption is already gone", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);

  await page.evaluate(() => window.showCaption(["the first line"]));
  await page.evaluate(() => window.showCaption(["the second line"]));
  await page.evaluate(() => window.clearCaption());

  await lookup(worker);

  await expect(page.locator("#vocab-panel .word")).toHaveText([
    "the",
    "second",
    "line",
  ]);
});

test("joins multi-segment captions with spaces", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);

  await page.evaluate(() =>
    window.showCaption(["run the whole", "department alone"]),
  );
  await lookup(worker);

  await expect(page.locator("#vocab-panel .word")).toHaveText([
    "run",
    "the",
    "whole",
    "department",
    "alone",
  ]);
});

test("strips surrounding punctuation and skips numbers and short words", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);

  await page.evaluate(() =>
    window.showCaption(['"Wait," he said — 42 times, a lot.']),
  );
  await lookup(worker);

  await expect(page.locator("#vocab-panel .word")).toHaveText([
    "Wait",
    "he",
    "said",
    "times",
    "lot",
  ]);
});

test("Escape closes the panel and resumes the video", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() => window.player.play());
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);

  await page.evaluate(() => window.showCaption(["run the department"]));
  await lookup(worker);
  await expect(page.locator("#vocab-panel")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator("#vocab-panel")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);
});
