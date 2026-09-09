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
      // Only for `npm run recording`, which turns the result into the README's animation.
      ...(process.env.RECORD
        ? {
            recordVideo: {
              dir: process.env.RECORD,
              size: { width: 1280, height: 720 },
            },
          }
        : {}),
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

/** The definition the stubbed dictionary returns for every word. */
export const MEANING = "to manage or be in charge of something";
export const EXAMPLE = "She runs the department single-handed.";
export const AUDIO =
  "https://api.dictionaryapi.dev/media/pronunciations/en/run-uk.mp3";

/** One entry in the shape api.dictionaryapi.dev answers with. */
export function entry(senses = [{ definition: MEANING, example: EXAMPLE }]) {
  return [
    {
      word: "run",
      phonetic: "/rʌn/",
      phonetics: [{ text: "/rʌn/", audio: AUDIO }],
      meanings: [{ partOfSpeech: "verb", definitions: senses }],
    },
  ];
}

interface WatchOptions {
  platform?: keyof typeof PLATFORMS;
  /** An entry, "missing" for the API's 404, or "unreachable" for the service being down. */
  dictionary?: unknown[] | "missing" | "unreachable";
  /** Called with each word the dictionary is asked for. Lookups run in the worker, so
   *  the page never sees these requests. */
  onLookup?: (word: string) => void;
}

/**
 * A watch page with the extension on it, served under the platform's own URL so the
 * manifest's match pattern applies and the content script is injected as in production.
 */
export async function watchPage(
  context: BrowserContext,
  { platform = "youtube", dictionary = entry(), onLookup }: WatchOptions = {},
): Promise<Page> {
  const { url, pattern, fixture } = PLATFORMS[platform];
  const html = readFileSync(resolve(here, fixture), "utf8");

  await context.route(pattern, (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await context.route("https://api.dictionaryapi.dev/**", (route) => {
    // The pronunciation lives on the same host as the entries.
    if (route.request().url().endsWith(".mp3")) {
      return route.fulfill({ contentType: "audio/mpeg", body: "" });
    }

    onLookup?.(
      decodeURIComponent(new URL(route.request().url()).pathname)
        .split("/")
        .pop() ?? "",
    );

    if (dictionary === "unreachable") {
      return route.abort();
    }

    if (dictionary === "missing") {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ title: "No Definitions Found" }),
      });
    }

    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(dictionary),
    });
  });

  const page = await context.newPage();
  await page.goto(url);
  return page;
}

/**
 * Required before measuring anything: a rect read mid-animation is where the animation
 * has it, not where it was placed.
 */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = document.getElementById("vocab-root")?.shadowRoot;
    const running = [...(root?.querySelectorAll("*") ?? [])].flatMap(
      (element) => element.getAnimations(),
    );
    await Promise.all(running.map((animation) => animation.finished));
  });
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
