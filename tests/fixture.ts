import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(here, "../extension/dist");

export const test = base.extend<{ context: BrowserContext; worker: Worker }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${distPath}`,
        `--load-extension=${distPath}`,
      ],
    });
    await use(context);
    await context.close();
  },

  // The extension's service worker. Tests drive it directly because a keyboard
  // shortcut registered through chrome.commands cannot be triggered from Playwright.
  worker: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    await use(worker);
  },
});

export const expect = test.expect;

const PLATFORMS = {
  youtube: {
    url: "https://www.youtube.com/watch?v=test",
    pattern: "https://www.youtube.com/**",
    fixture: "fixtures/youtube.html",
  },
  netflix: {
    url: "https://www.netflix.com/watch/12345",
    pattern: "https://www.netflix.com/**",
    fixture: "fixtures/netflix.html",
  },
};

/** What the stubbed server answers, in the shape the 2023 one still uses. */
export const MEANING = "to manage or be in charge of something";

interface WatchOptions {
  platform?: keyof typeof PLATFORMS;
  /** The lookup's answer, or "unreachable" to fail the request instead. */
  meaning?: Record<string, unknown> | "unreachable";
}

/**
 * A watch page with the extension on it. The fixture is served under the platform's own
 * URL so the manifest's match pattern applies and the content script is injected exactly
 * as it would be in production, and the meaning server is stubbed so no test depends on
 * anything running on localhost.
 */
export async function watchPage(
  context: BrowserContext,
  { platform = "youtube", meaning = { result: MEANING } }: WatchOptions = {},
): Promise<Page> {
  const { url, pattern, fixture } = PLATFORMS[platform];
  const html = readFileSync(resolve(here, fixture), "utf8");

  await context.route(pattern, (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await context.route("http://localhost:3000/**", (route) =>
    meaning === "unreachable"
      ? route.abort()
      : route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(meaning),
        }),
  );

  const page = await context.newPage();
  await page.goto(url);
  return page;
}

/** Starts the video and waits for it to actually be playing. */
export async function play(page: Page): Promise<void> {
  await page.evaluate(() => window.player.play());
  await expect
    .poll(() => page.evaluate(() => window.player.paused))
    .toBe(false);
}

export async function lookup(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id, { type: "LOOKUP_SUBTITLE" });
  });
}
