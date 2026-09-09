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
});

test("shows the meaning returned by the server", async ({
  context,
  worker,
}) => {
  await context.route("http://localhost:3000/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        result: "to manage or be in charge of something",
      }),
    }),
  );

  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  await page.getByRole("button", { name: "run", exact: true }).click();

  await expect(page.locator("#vocab-meaning")).toContainText(
    "to manage or be in charge of something",
  );
});

test("says so when the lookup fails instead of failing silently", async ({
  context,
  worker,
}) => {
  await context.route("http://localhost:3000/**", (route) => route.abort());

  const page = await context.newPage();
  await page.goto(WATCH_URL);
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  await page.getByRole("button", { name: "run", exact: true }).click();

  await expect(page.locator("#vocab-meaning")).toContainText(
    'Could not look up "run"',
  );
});

test("Escape also dismisses the result box", async ({ context, worker }) => {
  await context.route("http://localhost:3000/**", (route) => route.abort());

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
  await page.getByRole("button", { name: "run", exact: true }).click();
  await expect(page.locator("#vocab-meaning")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.locator("#vocab-meaning")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);
});
