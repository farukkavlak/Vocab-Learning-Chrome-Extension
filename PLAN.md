# Rewrite Plan

Working document. One phase per branch, merged into `main` before the next starts.

## Why

The 2023 version screenshotted the tab, sent the PNG to Google Cloud Vision for OCR, drew
a button over every recognised word, and asked a server for a definition.

1. OCR was unnecessary. Subtitles are in the DOM. Reading them back out of pixels is
   fragile, costs an API call per lookup, and needs `<all_urls>` plus screenshot
   permissions, which alone keep it out of the Web Store.
2. The word was sent without its line, so "run" got the same answer every time.
3. The server used `text-davinci-003` through `openai` v3. Both retired.
4. The content script matched `*://*/*` and knew nothing about where it was running.

## Phases

### 1 — `chore/cleanup`

- [x] Merge the two `.gitignore` files into one
- [x] Drop the unused `notifications`, `scripting` and `tabs` permissions
- [x] Narrow `host_permissions` and `content_scripts.matches` from `*://*/*`
- [x] Delete the `removeListener(arguments.callee)` line, which threw in strict mode
- [x] Move `nodemon` to `devDependencies`

### 2 — `chore/toolchain`

- [x] npm workspaces, Vite build, TypeScript, `@types/chrome`
- [x] Port `background.js` and `content.js` to `.ts`, types only
- [x] ESLint, Prettier, `.editorconfig`, husky + lint-staged
- [x] Scripts: `build`, `lint`, `format`, `typecheck`

Decided: plain TypeScript and CSS. React and Tailwind for one settings form is more
machinery than this earns.

### 3 — `refactor/remove-ocr`

- [x] Delete the Vision call, the API key constant, the base64 payload
- [x] Delete `captureVisibleTab` and the bbox maths (`dpr`, scroll offset, `innerWidth`)
- [x] Drop `vision.googleapis.com` from `host_permissions`
- [x] Read captions with a `MutationObserver` and keep the last ~5 lines with their
      `video.currentTime`

### 4 — `refactor/caption-port`

- [x] A `CaptionSource` port and a registry that picks by `matches(location.href)`
- [x] YouTube (`.ytp-caption-window-container`) and Netflix (`.player-timedtext`)
- [x] Generate the manifest's match patterns from the registry, so a platform is declared
      once
- [x] Prime (`.atvwebplayersdk-captions-text`), from a live session on 2026-09-09

Netflix's selectors are unverified against a live session. The tests prove the mechanism,
not the selectors.

Prime is on `primevideo.com` only. It also streams from `amazon.com/gp/video`, which
would mean injecting the content script into Amazon's shopping paths, so that is left
until it can be checked.

Prime cost the port four changes, each with a test that fails without it:

- Only the caption line carries a stable class. The fourteen ancestors between it and
  `.atvwebplayersdk-player-container` are generated (`span.fbhsa9`, `div.f1iwgj00`), so
  the container has to be the player. Hiding that while the panel stands in would black
  out the film, so `hideSelector` hides the lines instead.
- Prime breaks a long line with `<br>`, which contributes no whitespace to `textContent`:
  "confidentiality<br>codes" arrived as one word. `innerText` handles the break but reads
  as empty while the panel has the caption hidden, which put the glued line in the buffer
  instead. Both are avoided by replacing the breaks on a copy of the node.
- The container is the player, so the observer fires on every seek-bar tick. A line that
  has not changed returns before anything is measured.
- The first `<video>` in the document is a 0x0 placeholder, so `getVideo` takes the
  largest one rather than the first.

`containerIsCaptionLayer` says whether the container can stand in for a missing segment.
YouTube and Netflix draw captions in a layer of their own, where its text, bounds and font
size are the caption's. Prime's is the whole player, where each of those would be wrong:
the panel would be sized to the video and set in the player's UI font.

### 5 — `feat/overlay`

- [x] Remove the `window.alert` override and every inline style
- [x] A stylesheet in a shadow root, so the page and the panel cannot reach each other
- [x] The panel: shortcut, pause, clickable words, previous line above, Esc to resume

Decided: the panel takes the caption's place so the eye does not move, and the meaning
opens under the clicked word.

### 5b — polish

Screenshots of the built extension (`npm run shots`) showed what reading the code had not.

- [x] The panel grew downwards and ran off short windows. It is anchored on its own line
      of words, aligned to the caption's centre, and grows upwards.
- [x] Chips made the line read as a tag cloud. Every token is drawn now; only the words
      worth a lookup are buttons, marked on hover. The lookup still uses the bare word.
- [x] The fixed 19px became the caption's own computed size, so it matches in fullscreen.
      The card's text is scaled from it but bounded.
- [x] Width is the caption's plus what the hover padding adds, capped at 92% of the
      window.
- [x] The card was white over a dark video and covered the sentence. It is dark, points
      at its word, and clears the whole line.
- [x] Esc closes the card first, the panel second. The panel takes focus so the arrow
      keys walk the line. The hint says "click anywhere" rather than Esc: in fullscreen
      the browser takes Esc to leave fullscreen, so advertising it would throw the film
      out of fullscreen on the way past.

Resuming: the shortcut and Esc were the only ways back. The content script listens for
the video's `play` event now, so however it is started the panel gets out of the way.
Clicking outside dismisses it too. A video that was already paused is left paused.

### 6 — `refactor/meaning-provider`

Decided: **the dictionary answers first, the model only when asked.** The audience is
people learning English inside English, so an English definition is the answer they want.

The 2023 mistake was not using a model, it was sending the word alone. Measured against
`dictionaryapi.dev` on 2026-09-09:

|                       | Dictionary                                   | Model                         |
| --------------------- | -------------------------------------------- | ----------------------------- |
| `department`, `alone` | instant, free, cacheable                     | a wasted call and a 2s wait   |
| `run`                 | 63 senses, the first one literally "To run." | picks the sense the line uses |
| `run into`            | looks up "run", loses the phrasal verb       | sees the phrase               |
| `ran`, `better`       | often missing (`ran` answered 522 that day)  | unaffected                    |
| pronunciation         | IPA and a recording                          | cannot give one               |
| usage example         | a real example per sense                     | invents one                   |

- [x] `DictionaryApiProvider`: no key, the default. Fills `partOfSpeech`, `senses`,
      `example`, `phonetic`, `audio`.
- [x] "In this sentence" on the card asks the model with the whole line, and keeps the
      pronunciation the dictionary gave.
- [x] Providers are a registry like `sources/`. `llm.ts` holds the prompt, the schema and
      the request; `anthropic.ts` and `openai.ts` are a dozen lines each. The reader
      chooses this one, unlike a caption source, which recognises its own page.
- [x] Cache in `chrome.storage.local`, keyed by (provider, word), plus the sentence only
      for a provider that reads it. Keying the dictionary by sentence would miss every
      hit.
- [x] Show at most two senses of one part of speech.
- [x] Delete `AnswerFormat.js` and `server/`.
- [x] The pronunciation is fetched and played from a blob. A media element with a remote
      `src` answers to the host page's CSP.

```ts
type Meaning = {
  senses: { definition: string; example?: string }[];
  partOfSpeech?: string;
  phonetic?: string;
  audio?: string;
  phrase?: string; // set when the word belongs to an idiom or phrasal verb
  cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  translation?: string; // only when a target language is set
};
```

`senses` is a list because the dictionary answers with several and the model with one.
`phrase` matters: looking up "run" alone loses "run into". `cefr` lets the card stay short
for easy words. Both come from the model only.

Decided while building it:

- **Lookups run in the background worker.** Its requests carry the extension's own
  permissions, so no provider's CORS policy matters. Measured 2026-09-09: a page-origin
  preflight to `api.anthropic.com` is refused without
  `anthropic-dangerous-direct-browser-access`; from the worker it is not needed. The key
  also never enters a script sharing a page with the site.
- **Raw `fetch`, not each vendor's SDK.** Anthropic's guidance prefers the SDK, but one
  shared transport keeps both adapters the same shape and the worker at 8 KB, against
  9 MB unpacked for the Anthropic SDK alone. The cost is updating two request shapes by
  hand if an API changes.
- **`claude-haiku-4-5` and `gpt-4o-mini` as defaults.** A subtitle word is a small
  question.
- **Keys in `storage.local`, one per provider.** `sync` would carry them to Google.
- **The paid path sits behind a press,** so the extension is useful with no key, and the
  user's own key is a reasonable ask. That is why `server/` is gone: a hosted proxy buys
  nothing worth its bill.

`dictionaryapi.dev` is a community service with no SLA. It answered 522 three times while
this was built, so a 5xx or a dropped connection is retried twice with a short backoff,
and the reader is told the dictionary is not answering rather than shown a status code.
A second free dictionary is the next step if it keeps happening.

### 7 — `feat/settings`

- [x] Popup: the service first, then one key field, then an optional language
- [x] Provider hosts moved to `optional_host_permissions`, requested beside the key field.
      A keyless install is never asked, and a key is not saved if access is refused.
- [x] Each provider carries a `label` and a link to where its key is issued
- [x] Preferences in `chrome.storage.sync`, keys in `storage.local`, one per provider, so
      switching service does not throw the other key away
- [x] Link to `chrome://extensions/shortcuts`, opened with `chrome.tabs.create` because a
      page cannot link to a `chrome://` URL. `suggested_key` is only a suggestion: a taken
      combination is dropped in silence. It was never assigned under Vivaldi.

A translation is asked for only when a language is set, and then the prompt and the schema
both grow the field.

### 8 — `docs/readme`

- [x] Rewrite the README. The old one was a template with badges, a table of contents for
      three sections, and setup steps for a Vision key and a server that no longer exist.
- [x] `npm run recording` plays the flow once under Playwright and turns the video into
      `docs/flow.gif`, so it is regenerated rather than kept by hand
- [x] Delete `screenshots/`, which showed the OCR-era flow

### 9 — `feat/logbook`

Where this is going. A lookup popup is a commodity; the record is not. The line, the
video, the timestamp, and the fact that you did not know that word there.

- [ ] Save the word with its line, video and timestamp on lookup
- [ ] A page listing them, grouped by video
- [ ] Review built from the user's own sentences

It gives the extension a reason to be opened when nothing is playing, and puts the model
somewhere it earns its cost.

## Testing

Playwright drives a real Chromium with the built extension loaded.

- `npm test` — the deterministic suite. `context.route` serves a fixture under a
  `youtube.com` URL, so the manifest's match pattern applies and the content script is
  injected as in production.
- `npm run test:live` — hits youtube.com and checks only that the DOM contract holds.
- `npm run shots` — writes PNGs of the panel. Asserts nothing; the layout defects in
  phase 5b were invisible in test output.
- `npm run recording` — rebuilds `docs/flow.gif`. Needs ffmpeg.

Anything asserting on geometry waits for the opening animation first (`settled()` in
`tests/fixture.ts`). A rect read mid-animation is where the animation has it, not where it
was placed, which is what an intermittent 2-4px failure turned out to be.

Four things the suite cannot cover:

1. **Caption text on the live site.** YouTube reports every caption track as
   `is_servable: false` for a signed-out automated session, so no subtitle is rendered
   under Playwright. The fixture's markup is our reconstruction.
2. **The keyboard shortcut.** `chrome.commands` shortcuts cannot be triggered from
   Playwright, so tests message the content script directly and the wiring in
   `background.ts` is untested.
3. **Granting an optional host permission.** Chrome asks in its own bubble, which
   Playwright cannot click, so `chrome.permissions.request` is stubbed. The permission is
   enforced (a worker `fetch` to an ungranted origin fails, measured 2026-09-09), but a
   routed request is fulfilled before Chrome checks, so the model tests pass without it.
   What the suite proves is that the page asks for the right origin and refuses to save a
   key when access is denied.
4. **A live call to a model provider.** Both are stubbed. One real call with a real key
   should be made by hand before release.

Checked by hand on YouTube, 2026-09-09: the panel showed the words of the line on screen,
and the buffer served the previous line after the caption had cleared.

## Deferred

**Hosted backend.** Settled in phase 6: bring-your-own-key, and `server/` is deleted.
Revisit only if key handling turns out to be what stops people installing it.
