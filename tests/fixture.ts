import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";
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

export async function lookup(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id, { type: "LOOKUP_SUBTITLE" });
  });
}
