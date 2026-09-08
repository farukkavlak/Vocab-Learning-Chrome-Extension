# Rewrite Plan

Working document. One phase per branch, each merged into `main` before the next starts.

Baseline is `main` as it stands: two plain JavaScript files, no build step, and an
Express server. The `refactor` branch (Vite + TS + React + Tesseract) is **abandoned** —
it was half-finished and carried its own defects. It stays on the remote for now only so
its `vite.config.ts` can be salvaged in Phase 2; delete it after that.

## Why a rewrite

The 2023 version works like this: on a shortcut, screenshot the tab, send the PNG to the
**Google Cloud Vision** API for OCR, overlay an absolutely positioned button on every
recognised word, and on click ask the server for a definition.

Four things are wrong with that, and they are the reason for this rewrite:

1. **OCR is unnecessary.** Subtitles are already in the DOM. Reading pixels back out of a
   screenshot is fragile (device pixel ratio, zoom, fullscreen, scroll offset), costs an
   API call per lookup, and needs `<all_urls>` plus screenshot permissions — which alone
   would keep the extension out of the Chrome Web Store.
2. **Definitions have no context.** The word is sent to the model on its own, so "run"
   gets the same answer every time. The full subtitle line is right there — using it is
   the entire value of the project.
3. **The AI path is dead.** The server calls `createCompletion` with `text-davinci-003`
   through `openai` v3. Both are retired. This is not an optional upgrade.
4. **Nothing is platform-agnostic.** The content script matches `*://*/*` and knows
   nothing about where it is, so it cannot read subtitles from anywhere specifically.

## Known defects in the current code

- [ ] `extension/content.js` holds `googleVisionApiKey` client-side (placeholder today,
      but the design puts a paid key in the client)
- [ ] `extension/manifest.json` requests `notifications`, `scripting` and `tabs`, none of
      which are used; `host_permissions` and `content_scripts.matches` are both `*://*/*`
- [ ] `chrome.runtime.onMessage.removeListener(arguments.callee)` inside a `.then`
      callback targets the wrong listener and throws in strict mode — dead line
- [ ] Every style is inline in `content.js`; there is no stylesheet
- [ ] Two `.gitignore` files (root and `server/`) that mostly duplicate each other
- [ ] `server/` depends on `nodemon` as a production dependency
- [ ] `AnswerFormat.js` exists only to patch up leading/trailing punctuation in free-text
      model output — the problem structured output removes entirely

## Phases

### Phase 1 — `chore/cleanup`

No tooling, no logic. Just remove what is plainly dead.

- [ ] Merge the two `.gitignore` files into one at the root
- [ ] Drop the `notifications`, `scripting` and `tabs` permissions from the manifest
- [ ] Narrow `host_permissions` and `content_scripts.matches` from `*://*/*` to the
      platforms actually supported
- [ ] Delete the `removeListener(arguments.callee)` line
- [ ] Move `nodemon` to `devDependencies`

### Phase 2 — `chore/toolchain`

Set the workbench up once, before touching any behaviour.

- [ ] Root `package.json` with npm workspaces (`extension`, `server`)
- [ ] Vite build for the extension; salvage `vite.config.ts` from the `refactor` branch,
      and make it copy the manifest and static assets so `npm run build` emits a
      directory that loads as an unpacked extension
- [ ] TypeScript + `tsconfig.json` (no wildcard `paths`) and `@types/chrome`
- [ ] Mechanically port `background.js` and `content.js` to `.ts` — types only, no logic
      changes. It is ~250 lines total.
- [ ] ESLint flat config + `@typescript-eslint`
- [ ] Prettier with default settings (no bikeshedding) + `eslint-config-prettier`
- [ ] `.editorconfig`
- [ ] Scripts: `build`, `lint`, `format`, `typecheck`
- [ ] `husky` + `lint-staged` so commits are formatted automatically
- [ ] Run `prettier --write .` once, as the last commit on the branch

`server/` is left out of the port on purpose — it is rewritten from scratch in Phase 6,
so converting it now would be thrown away. Lint may ignore it until then.

**Open decision:** no popup exists yet, so nothing forces a UI framework. Recommendation
is plain TypeScript and CSS for both the overlay and the settings page — React plus
Tailwind for one settings form is more machinery than the project earns.

### Phase 3 — `refactor/remove-ocr`

- [ ] Delete the Google Vision call, the API key constant and the base64 payload
- [ ] Delete the screenshot path in `background.ts` (`captureVisibleTab`) and the
      `isScreenshot` message
- [ ] Delete the bbox→percentage math (`dpr`, `scrollOffset`, `innerWidth`) and the
      per-word absolutely positioned buttons
- [ ] Drop the screenshot-related permissions from the manifest
- [ ] Replace with a subtitle ring buffer: a `MutationObserver` on the caption container
      keeping the last ~5 lines with their `video.currentTime`

Ends with the extension smaller, its permissions harmless, and no third-party OCR bill.

### Phase 4 — `refactor/caption-port`

Ports and adapters. The content script must not know any platform.

```ts
type CaptionLine = { text: string; at: number };

interface CaptionSource {
  readonly id: string;
  matches(url: string): boolean;
  attach(onLine: (line: CaptionLine) => void): () => void; // returns detach
  getVideo(): HTMLVideoElement | null;
}
```

- [ ] `CaptionSource` port + a registry that picks by `matches(location.href)`
- [ ] `YouTubeCaptionSource` (`.ytp-caption-window-container`)
- [ ] `NetflixCaptionSource` (`.player-timedtext`)
- [ ] Generate the manifest's `content_scripts.matches` and `host_permissions` from the
      registry at build time, so platforms are declared in exactly one place

Adding a platform should be one new file plus one line in the registry.

### Phase 5 — `feat/overlay`

- [ ] Remove the `window.alert` override (`createCustomAlert`) and every inline style
- [ ] A real stylesheet, injected in a shadow root so the host page cannot bleed into it
- [ ] Own panel: shortcut → pause → split the buffered line into clickable words → show
      the previous line dimmed above → Esc or close → resume

This is the visible face of the project and the weakest part of the old version. Worth
spending real time on.

### Phase 6 — `refactor/meaning-provider`

The server has to be rewritten regardless, so redesign it rather than repair it.

```ts
interface MeaningProvider {
  lookup(word: string, sentence: string, targetLang: string): Promise<Meaning>;
}
```

- [ ] `DictionaryApiProvider` — no key, free, context-free; the zero-setup default
- [ ] `LlmProvider` — current SDK, current model, structured output, context-aware
- [ ] Cache in `chrome.storage.local` keyed by (word, sentence)
- [ ] Delete `AnswerFormat.js`; structured output removes the problem it patched

Keeping both behind one interface means the "hosted backend or bring-your-own-key?"
decision does not have to be made now.

**The schema is the point.** What changed since 2023 is less that models got better and
more what we are able to ask. Not "what does *run* mean" but "what does *run* mean in
*He had to run the whole department alone*":

```ts
type Meaning = {
  meaningInContext: string;
  translation: string;
  partOfSpeech: string;
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  phrase?: string; // set when the word belongs to an idiom / phrasal verb
};
```

`phrase` matters: looking up "run" alone silently loses "run into". `cefr` lets the panel
stay short for easy words.

### Phase 7 — `feat/settings`

- [ ] Extension popup: target language, provider, API key, shortcut
- [ ] Persist in `chrome.storage.sync`

### Phase 8 — `docs/readme`

- [ ] Rewrite the README from scratch
- [ ] Screen recording of the real flow
- [ ] Keep the history in it: Vision OCR first, DOM subtitles later, and why

## Deferred

- **Word logbook / spaced repetition.** Revisit after Phase 7, backed by `chrome.storage`.
- **Hosted backend.** `server/` is untouched until Phase 6 decides whether a hosted proxy
  or bring-your-own-key wins. If BYO key wins, `server/` is deleted outright.
