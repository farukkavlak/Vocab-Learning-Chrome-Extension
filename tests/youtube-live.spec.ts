import { test, expect } from "./fixture";

/**
 * Runs against the real youtube.com. Excluded from `npm test` because it needs the
 * network and can break for reasons that have nothing to do with this repo; run it with
 * `npm run test:live`.
 *
 * It checks the one thing the fixture tests cannot: that the DOM contract the content
 * script is written against still holds on the live site. It deliberately does not
 * assert on caption *text* — YouTube reports every caption track as `is_servable: false`
 * for an automated, signed-out session, so no subtitle is ever rendered here. Verifying
 * that words actually reach the panel still needs a human watching a real video once.
 */
const WATCH_URL = "https://www.youtube.com/watch?v=8S0FDjFBj8o&hl=en";

test("@live the caption container and player controls still exist on youtube", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(WATCH_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.locator(".ytp-caption-window-container")).toHaveCount(1);
  await expect(page.locator(".ytp-subtitles-button")).toHaveCount(1);

  const trackCount = await page.evaluate(() => {
    const player = document.querySelector("#movie_player") as unknown as {
      getOption: (module: string, option: string) => unknown[] | undefined;
    };
    return player.getOption("captions", "tracklist")?.length ?? 0;
  });
  expect(trackCount).toBeGreaterThan(0);
});
