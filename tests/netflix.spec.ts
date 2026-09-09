import { test, expect, lookup, watchPage } from "./fixture";

/**
 * Netflix's real selectors are unverified — this proves the adapter mechanism, not the
 * selectors. The fixture mirrors the structure the adapter is written against.
 */
test("the netflix adapter reads captions from its own container", async ({
  context,
  worker,
}) => {
  const page = await watchPage(context, { platform: "netflix" });

  await page.evaluate(() =>
    window.showCaption(["he had to", "run the department"]),
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
