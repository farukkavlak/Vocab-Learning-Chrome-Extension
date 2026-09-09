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
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixtureHtml }),
  );
  await context.route("http://localhost:3000/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        result: "to manage or be in charge of something",
      }),
    }),
  );
});

test("stands in for the caption instead of appearing somewhere else", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  const text = await page.locator(".ytp-caption-segment").first().boundingBox();
  const panel = await page.locator("#vocab-panel").boundingBox();

  // Where the words are, not where the caption layer starts. That layer covers the whole
  // video, so positioning from it would put the panel at the top of the screen.
  expect(panel?.y).toBeCloseTo(text?.y ?? 0, 0);
  expect(panel?.y ?? 0).toBeGreaterThan(200);

  // The real caption is hidden so the words are not drawn twice.
  await expect(page.locator(".ytp-caption-window-container")).toHaveCSS(
    "visibility",
    "hidden",
  );
});

test("shows the previous line above, as plain text", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() => window.showCaption(["he had to run the whole"]));
  await page.evaluate(() => window.showCaption(["department alone this year"]));
  await lookup(worker);

  await expect(page.locator("#vocab-panel .previous")).toHaveText(
    "he had to run the whole",
  );
  await expect(page.locator("#vocab-panel .word")).toHaveText([
    "department",
    "alone",
    "this",
    "year",
  ]);
});

test("opens the meaning above the word when there is no room below", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  const word = page.getByRole("button", { name: "run", exact: true });
  await word.click();
  await expect(page.locator("#vocab-meaning")).toContainText("to manage");

  const wordBox = await word.boundingBox();
  const meaningBox = await page.locator("#vocab-meaning").boundingBox();

  expect(meaningBox?.y ?? 0).toBeLessThan(wordBox?.y ?? 0);
  expect(meaningBox?.y ?? 0).toBeGreaterThan(0);
});

test("restores the caption when the panel is dismissed", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);
  await page.keyboard.press("Escape");

  await expect(page.locator("#vocab-panel")).toHaveCount(0);
  await expect(page.locator(".ytp-caption-window-container")).toHaveCSS(
    "visibility",
    "visible",
  );
});

test("the shortcut toggles: pressing it again resumes the video", async ({
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
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);
  await expect(page.locator("#vocab-panel")).toBeVisible();

  await lookup(worker);

  await expect(page.locator("#vocab-panel")).toHaveCount(0);
  await expect(page.locator(".ytp-caption-window-container")).toHaveCSS(
    "visibility",
    "visible",
  );
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);
});
