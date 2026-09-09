import type { BrowserContext, Worker } from "@playwright/test";
import { test, expect, lookup, play, watchPage } from "./fixture";

async function openPanel(
  context: BrowserContext,
  worker: Worker,
  { playing = true } = {},
) {
  const page = await watchPage(context);
  if (playing) {
    await play(page);
  }

  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);
  await expect(page.locator("#vocab-panel")).toBeVisible();
  return page;
}

test("starting the video any other way puts the panel away", async ({
  context,
  worker,
}) => {
  const page = await openPanel(context, worker);

  // The player's own button, Space, a double click: none of them go through this
  // extension. Without this the video would play on behind a frozen panel, with the
  // real captions still hidden underneath it.
  await page.evaluate(() => window.player.play());

  await expect(page.locator("#vocab-panel")).toHaveCount(0);
  await expect(page.locator(".ytp-caption-window-container")).toHaveCSS(
    "visibility",
    "visible",
  );
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);
});

test("clicking away puts the panel away and resumes", async ({
  context,
  worker,
}) => {
  const page = await openPanel(context, worker);

  await page.mouse.click(20, 20);

  await expect(page.locator("#vocab-panel")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);
});

test("clicking inside the panel keeps it open", async ({ context, worker }) => {
  const page = await openPanel(context, worker);

  await page
    .locator("#vocab-panel .previous, #vocab-panel .hint")
    .last()
    .click();

  await expect(page.locator("#vocab-panel")).toBeVisible();
  expect(await page.evaluate(() => window.player.paused)).toBe(true);
});

test("a video the user had already paused is left paused", async ({
  context,
  worker,
}) => {
  // Nothing was playing, so there is nothing to resume: starting the video here would
  // be the extension deciding something the user did not ask for.
  const page = await openPanel(context, worker, { playing: false });
  expect(await page.evaluate(() => window.player.paused)).toBe(true);

  await page.keyboard.press("Escape");

  await expect(page.locator("#vocab-panel")).toHaveCount(0);
  expect(await page.evaluate(() => window.player.paused)).toBe(true);
});
