// Writes PNGs of the panel to ./shots for visual review. Not part of `npm test`: it
// asserts nothing, and every run overwrites the images. Run it with `npm run shots`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { BrowserContext, Worker } from "@playwright/test";
import { test, lookup } from "./fixture";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  resolve(here, "fixtures/youtube.html"),
  "utf8",
);
const OUT = process.env.SHOT_DIR ?? "shots";
const WATCH_URL = "https://www.youtube.com/watch?v=test";

const scene = (captionBottom: number) => `
  video { width: 1280px; height: 720px; object-fit: cover;
    background: linear-gradient(160deg,#3a4a63 0%,#6b7f96 40%,#c9b79c 75%,#8a6f4e 100%); }
  body { background:#000 }
  /* Roughly YouTube's own caption look, so the "before" shot is comparable. */
  .caption-window { bottom: ${captionBottom}px; font: 400 28px/1.35 "Roboto", system-ui, sans-serif; }
  .ytp-caption-segment { background: rgba(8,8,8,0.75); padding: 2px 6px; }
`;

test.beforeEach(async ({ context }) => {
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixtureHtml }),
  );
  await context.route("http://localhost:3000/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        meaningInContext: "to be the only person doing something, with no help",
        translation: "tek başına, yardımsız",
        partOfSpeech: "adverb",
        cefr: "A2",
      }),
    }),
  );
});

async function open(context: BrowserContext, captionBottom: number) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(WATCH_URL);
  await page.addStyleTag({ content: scene(captionBottom) });
  await page.evaluate(() => window.showCaption(["he had to run the whole"]));
  await page.waitForTimeout(80);
  await page.evaluate(() => window.showCaption(["department alone this year"]));
  await page.waitForTimeout(80);
  return page;
}

test("@shots design shots (caption raised so the whole panel is visible)", async ({
  context,
  worker,
}) => {
  const page = await open(context, 260);
  await page.screenshot({ path: `${OUT}/1-before.png` });

  await lookup(worker);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/2-panel.png` });

  const word = page.getByRole("button", { name: "alone", exact: true });
  await word.hover();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/3-hover.png` });

  await word.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/4-meaning.png` });

  const box = await page.locator("#vocab-panel").boundingBox();
  const m = await page.locator("#vocab-meaning").boundingBox();
  if (box && m) {
    const x = Math.min(box.x, m.x) - 30;
    const y = Math.min(box.y, m.y) - 30;
    await page.screenshot({
      path: `${OUT}/5-closeup.png`,
      clip: {
        x,
        y,
        width: Math.max(box.x + box.width, m.x + m.width) - x + 30,
        height: Math.max(box.y + box.height, m.y + m.height) - y + 30,
      },
    });
  }
  await page.close();
});

test("@shots a caption the player broke into two lines", async ({
  context,
  worker,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(WATCH_URL);
  await page.addStyleTag({ content: scene(72) });
  await page.evaluate(() =>
    window.showCaption([
      "and if you ask me whether he had to run the whole",
      "department alone this year, the answer is absolutely not",
    ]),
  );
  await page.waitForTimeout(80);
  await lookup(worker);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/8-two-lines.png` });
  await page.close();
});

test("@shots realistic caption position", async ({ context, worker }) => {
  const page = await open(context, 72);
  await page.screenshot({ path: `${OUT}/6-real-before.png` });
  await lookup(worker);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/7-real-panel.png` });
  await page.close();
});
