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

- [x] `extension/content.js` holds `googleVisionApiKey` client-side (placeholder today,
      but the design puts a paid key in the client)
- [x] `extension/manifest.json` requests `notifications`, `scripting` and `tabs`, none of
      which are used; `host_permissions` and `content_scripts.matches` are both `*://*/*`
- [x] `chrome.runtime.onMessage.removeListener(arguments.callee)` inside a `.then`
      callback targets the wrong listener and throws in strict mode — dead line
- [x] `content.js` builds a `buttons` array that is never read
- [x] Every style is inline in `content.js`; there is no stylesheet
- [x] Two `.gitignore` files (root and `server/`) that mostly duplicate each other
- [x] `server/` depends on `nodemon` as a production dependency
- [ ] `AnswerFormat.js` exists only to patch up leading/trailing punctuation in free-text
      model output — the problem structured output removes entirely

## Phases

### Phase 1 — `chore/cleanup`

No tooling, no logic. Just remove what is plainly dead.

- [x] Merge the two `.gitignore` files into one at the root
- [x] Drop the `notifications`, `scripting` and `tabs` permissions from the manifest
- [x] Narrow `host_permissions` and `content_scripts.matches` from `*://*/*` to the
      platforms actually supported
- [x] Delete the `removeListener(arguments.callee)` line
- [x] Move `nodemon` to `devDependencies`

### Phase 2 — `chore/toolchain`

Set the workbench up once, before touching any behaviour.

- [x] Root `package.json` with npm workspaces (`extension`, `server`)
- [x] Vite build for the extension; salvage `vite.config.ts` from the `refactor` branch,
      and make it copy the manifest and static assets so `npm run build` emits a
      directory that loads as an unpacked extension
- [x] TypeScript + `tsconfig.json` (no wildcard `paths`) and `@types/chrome`
- [x] Mechanically port `background.js` and `content.js` to `.ts` — types only, no logic
      changes. It is ~250 lines total.
- [x] ESLint flat config + `@typescript-eslint`
- [x] Prettier with default settings (no bikeshedding) + `eslint-config-prettier`
- [x] `.editorconfig`
- [x] Scripts: `build`, `lint`, `format`, `typecheck`
- [x] `husky` + `lint-staged` so commits are formatted automatically
- [x] Run `prettier --write .` once, as the last commit on the branch

`server/` is left out of the port on purpose — it is rewritten from scratch in Phase 6,
so converting it now would be thrown away. Lint may ignore it until then.

**Decided:** plain TypeScript and CSS for both the overlay and the settings page. No
popup exists yet, so nothing forced a UI framework, and React plus Tailwind for one
settings form is more machinery than the project earns.

### Phase 3 — `refactor/remove-ocr`

- [x] Delete the Google Vision call, the API key constant and the base64 payload
- [x] Delete the screenshot path in `background.ts` (`captureVisibleTab`) and the
      `isScreenshot` message
- [x] Delete the bbox→percentage math (`dpr`, `scrollOffset`, `innerWidth`) and the
      per-word absolutely positioned buttons
- [x] Drop `https://vision.googleapis.com/*` from `host_permissions` (kept in Phase 1
      only so the current behaviour was not broken by narrowing the wildcard)
- [x] Replace with a subtitle ring buffer: a `MutationObserver` on the caption container
      keeping the last ~5 lines with their `video.currentTime`

Ends with the extension smaller, its permissions harmless, and no third-party OCR bill.

## Testing

Playwright drives a real Chromium with the built extension loaded.

- `npm test` — the deterministic suite. `context.route` serves a local fixture under a
  `youtube.com` URL, so the manifest's match pattern applies and the content script is
  injected exactly as in production. Covers the buffer, the fallback to the last line,
  multi-segment joining, word filtering, pause and resume.
- `npm run test:live` — hits the real youtube.com and asserts only that the DOM contract
  still holds (caption container, subtitles button, a non-empty caption tracklist).
- `npm run shots` — writes PNGs of the panel to `shots/`. Asserts nothing; it exists
  because the layout defects above were invisible in the test output.

Two things this cannot cover, and a human has to check once per platform (both were
verified by hand on YouTube on 2026-09-09: the panel showed the words of the line that
was on screen, and the buffer served the previous line after the caption had cleared):

1. **Caption text on the live site.** YouTube reports every caption track as
   `is_servable: false` for an automated, signed-out session, so no subtitle is ever
   rendered under Playwright. The fixture's caption markup is our reconstruction of
   YouTube's, not a capture of it.
2. **The keyboard shortcut.** `chrome.commands` shortcuts are registered by the browser
   and cannot be triggered from Playwright, so tests send `LOOKUP_SUBTITLE` to the
   content script directly and the wiring in `background.ts` is untested.

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

- [x] `CaptionSource` port + a registry that picks by `matches(location.href)`
- [x] `YouTubeCaptionSource` (`.ytp-caption-window-container`)
- [x] `NetflixCaptionSource` (`.player-timedtext`)
- [x] Generate the manifest's `content_scripts.matches` and `host_permissions` from the
      registry at build time, so platforms are declared in exactly one place

Adding a platform is one new file plus one line in the registry.

Netflix's selectors have not been checked against a live session. The suite proves the
adapter mechanism against a fixture, not that `.player-timedtext` is still correct.

### Phase 5 — `feat/overlay`

- [x] Remove the `window.alert` override (`createCustomAlert`) and every inline style
- [x] A real stylesheet, injected in a shadow root so the host page cannot bleed into it
- [x] Own panel: shortcut → pause → split the buffered line into clickable words → show
      the previous line dimmed above → Esc or close → resume

Decided while building it: the panel takes the caption's place rather than opening
elsewhere, so the eye never moves; the meaning opens under the clicked word, flipping
above it when there is no room below, which near the bottom of the screen is most of the
time; the previous line sits above as plain text, for context but not clickable.

### Phase 5b — polish

The first pass was drawn against a fixture and never looked at. Screenshots of the built
extension (`npm run shots`) showed what reading the code had not:

- [x] The panel grew downwards from the caption's top, so in a short window it ran off
      the bottom of the screen. It is anchored by its own line of words now, which is
      lined up on the caption's centre; the box grows upwards from there.
- [x] The words were chips in a row, which read as a tag cloud rather than a sentence.
      Every token is rendered now — punctuation, numbers and one-letter words as plain
      text — and only the words worth a lookup are buttons, marked on hover alone. The
      lookup still uses the bare word.
- [x] The panel used a fixed 19px. It takes the caption's own computed size now, so it
      matches in a small window and in fullscreen; the card's prose is scaled from it
      but bounded, since prose set at caption size is unreadable.
- [x] Its width was the caption's times 1.15. The extra room a line needs is its words'
      hover padding, which follows the word count, not the caption's width; past that it
      wraps where the caption did, and never spans more than 92% of the window.
- [x] The meaning card was white on a dark video and covered the rest of the sentence.
      It is dark now, points at its word with an arrow, and clears the whole line —
      the sentence is the context the meaning is read in.
- [x] The card already lays out the Phase 6 schema (part of speech, CEFR, phrase,
      translation), so that phase only has to supply the data.
- [x] Esc closes the card first and the panel second; the panel takes focus so the arrow
      keys walk the line without tabbing into the shadow root.

**Resuming.** The shortcut and Esc were the only ways back to the video, so pressing the
player's own play button left the video running behind a frozen panel with the real
captions still hidden. The content script listens for the video's `play` event now:
however the user starts it — Space, the player, a double click — the panel gets out of
the way. Clicking outside it dismisses it too, and a video that was already paused before
the lookup is left paused, since resuming it would be a decision the user never made.

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
more what we are able to ask. Not "what does _run_ mean" but "what does _run_ mean in
_He had to run the whole department alone_":

```ts
type Meaning = {
  meaningInContext: string;
  translation: string;
  partOfSpeech: string;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  phrase?: string; // set when the word belongs to an idiom / phrasal verb
};
```

`phrase` matters: looking up "run" alone silently loses "run into". `cefr` lets the panel
stay short for easy words.

### Phase 7 — `feat/settings`

- [ ] Extension popup: target language, provider, API key
- [ ] Persist in `chrome.storage.sync`
- [ ] Link to `chrome://extensions/shortcuts` from the popup. `suggested_key` is only a
      suggestion: if the combination is already taken the browser drops it silently and
      the command shows as "Not set", with no error anywhere. It was never assigned on
      first install under Vivaldi, whose own shortcut set is far denser than Chrome's.

### Phase 8 — `docs/readme`

- [ ] Rewrite the README from scratch
- [ ] Screen recording of the real flow
- [ ] Keep the history in it: Vision OCR first, DOM subtitles later, and why

## Deferred

- **Word logbook / spaced repetition.** Revisit after Phase 7, backed by `chrome.storage`.
- **Hosted backend.** `server/` is untouched until Phase 6 decides whether a hosted proxy
  or bring-your-own-key wins. If BYO key wins, `server/` is deleted outright.
