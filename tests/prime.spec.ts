import { test, expect, lookup, watchPage } from "./fixture";

/**
 * Prime's markup is reproduced from a live session on 2026-09-09. Only
 * `atvwebplayersdk-captions-text` and the player container carry stable names; the
 * fourteen levels between them are generated and will change.
 */
test("reads a caption that sits far below the player container", async ({
  context,
  worker,
}) => {
  const page = await watchPage(context, { platform: "prime" });
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  await expect(page.locator("#vocab-panel .word")).toHaveText([
    "he",
    "had",
    "to",
    "run",
    "the",
    "department",
  ]);
});

test("does not glue words together across a line break", async ({
  context,
  worker,
}) => {
  // Prime breaks a long line with <br>, which contributes no whitespace to textContent.
  const page = await watchPage(context, { platform: "prime" });
  await page.evaluate(() =>
    window.showCaption([
      "by the same client confidentiality<br>codes that all",
    ]),
  );
  await lookup(worker);

  await expect(page.locator("#vocab-panel .line")).toHaveText(
    "by the same client confidentiality codes that all",
  );
});

test("keeps the line unglued after the panel has hidden the caption", async ({
  context,
  worker,
}) => {
  // The panel hides the caption lines while it stands in for them. A hidden element has
  // no innerText, so reading the caption that way fell back to textContent and glued the
  // words around the <br> again. Prime's container is the whole player, so any control
  // that moves while paused re-reads the caption and would bank the glued line.
  const page = await watchPage(context, { platform: "prime" });
  await page.evaluate(() =>
    window.showCaption(["by the same client confidentiality<br>codes"]),
  );
  await lookup(worker);
  await expect(page.locator("#vocab-panel")).toBeVisible();

  await page.evaluate(() => {
    const player = document.querySelector(".atvwebplayersdk-player-container");
    player?.appendChild(document.createElement("span"));
  });
  await page.waitForTimeout(100);

  await page.keyboard.press("Escape");
  await page.evaluate(() => window.showCaption(["that all doctors abide by"]));
  await lookup(worker);

  await expect(page.locator("#vocab-panel .previous")).toHaveText(
    "by the same client confidentiality codes",
  );
});

test("opens from the buffer when the caption has already cleared", async ({
  context,
  worker,
}) => {
  // With no caption on screen there is no rect and no font size to copy, and the
  // container is the player: measuring that would size the panel to the whole video.
  const page = await watchPage(context, { platform: "prime" });
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await page.evaluate(() => window.clearCaption());
  await lookup(worker);

  const panel = await page.locator("#vocab-panel").boundingBox();
  const viewport = page.viewportSize();
  expect(panel?.width ?? 0).toBeLessThan((viewport?.width ?? 0) * 0.9);
  await expect(page.locator("#vocab-panel .word").first()).toHaveText("he");
});

test("pauses the video that is playing, not the empty one before it", async ({
  context,
  worker,
}) => {
  const page = await watchPage(context, { platform: "prime" });
  await page.evaluate(() => window.player.play());
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);

  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  expect(await page.evaluate(() => window.player.paused)).toBe(true);
});

test("hides the caption lines and leaves the player showing", async ({
  context,
  worker,
}) => {
  // The nearest stable ancestor is the whole player: hiding that would black out the
  // film.
  const page = await watchPage(context, { platform: "prime" });
  await page.evaluate(() =>
    window.showCaption(["he had to run the department"]),
  );
  await lookup(worker);

  await expect(page.locator(".atvwebplayersdk-captions-text")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(page.locator(".atvwebplayersdk-player-container")).toHaveCSS(
    "visibility",
    "visible",
  );

  await page.keyboard.press("Escape");
  await expect(page.locator(".atvwebplayersdk-captions-text")).toHaveCSS(
    "visibility",
    "visible",
  );
});
