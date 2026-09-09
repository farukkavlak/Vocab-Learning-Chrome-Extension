import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test, expect, lookup } from "./fixture";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  resolve(here, "fixtures/netflix.html"),
  "utf8",
);

/**
 * Netflix's real selectors are unverified — this proves the adapter mechanism, not the
 * selectors. The fixture mirrors the structure the adapter is written against.
 */
test("the netflix adapter reads captions from its own container", async ({
  context,
  worker,
}) => {
  await context.route("https://www.netflix.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixtureHtml }),
  );

  const page = await context.newPage();
  await page.goto("https://www.netflix.com/watch/12345");

  await page.evaluate(() =>
    window.showCaption(["he had to", "run the department"]),
  );
  await lookup(worker);

  await expect(page.locator("#vocab-container button")).toHaveText([
    "he",
    "had",
    "to",
    "run",
    "the",
    "department",
  ]);
});
