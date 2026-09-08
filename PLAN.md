# Rewrite Plan

Working document. One phase per branch, each merged into `main` before the next starts.

## Why a rewrite

The 2023 version worked like this: take a screenshot on a shortcut, OCR it with
Tesseract, overlay a button on top of every recognised word, and on click fetch the
first definition from a free dictionary API.

Three things are wrong with that, and they are the reason for this rewrite:

1. **OCR is unnecessary.** Subtitles are already in the DOM. Reading pixels back out
   of a screenshot is fragile (device pixel ratio, zoom, fullscreen, scroll offset) and
   drags in Tesseract plus the `desktopCapture` / `scripting` permissions, which alone
   would keep the extension out of the Chrome Web Store.
2. **Definitions have no context.** `meanings[0].definitions[0]` returns the same answer
   for "run" every time. The full subtitle line is right there — using it is the whole
   value of the project.
3. **Nothing is platform-agnostic.** YouTube specifics are hardcoded into the content
   script, so a second platform means a second content script.

## Known defects in the current code

Found while surveying `refactor` (all still open):

- [ ] `extension/src/package.json` is a stale duplicate of the root `package.json`
- [ ] Two conflicting manifests: `public/manifest.json` (old: `*://*/*`, `Ctrl+H`) and
      `src/manifest.json` (current). `vite.config.ts` copies neither.
- [ ] `extension/dist/` and `server/VocabularyService/dist/` are committed despite
      `dist` being in `.gitignore`
- [ ] Broken contract: backend returns `{ success, result }`, content script reads
      `result.data.word`
- [ ] `store.ts` is imported from both the popup and the content script. These are
      separate JS realms, so they get separate Zustand instances and history written by
      the content script never reaches the popup. `web_accessible_resources` listing
      `store.js` is an attempt to paper over this.
- [ ] `tsconfig.json` has `"paths": { "*": ["*", "*.tsx", "*.ts"] }`, which lets any
      import resolve to almost anything

## Phases

### Phase 0 — `chore/baseline`
- [ ] Fast-forward `main` to `refactor` (`main` is 0 ahead / 6 behind)
- [ ] Delete the `refactor` branch locally and on the remote

Everything after this happens on a single line of history.

### Phase 1 — `chore/tooling`
- [ ] ESLint flat config + `@typescript-eslint` + `eslint-plugin-react-hooks`
- [ ] Prettier (defaults only — no bikeshedding) + `eslint-config-prettier`
- [ ] `.editorconfig`
- [ ] Scripts: `lint`, `format`, `typecheck`
- [ ] `husky` + `lint-staged` so commits are formatted automatically

Tooling only. Do not fix any code here, or the diff becomes unreadable.

### Phase 2 — `chore/format`
- [ ] `prettier --write .` as a single commit

Large but purely mechanical. Kept separate so that no later diff mixes whitespace with
logic.

### Phase 3 — `chore/cleanup`
- [ ] Delete `extension/src/package.json`
- [ ] Delete `extension/public/manifest.json`, keep exactly one manifest
- [ ] `git rm -r --cached` the two `dist/` directories, fix `.gitignore`
- [ ] Remove the wildcard `paths` from `tsconfig.json`
- [ ] Make `vite.config.ts` copy the manifest and `public/` so `npm run build` emits a
      directory that actually loads as an unpacked extension

### Phase 4 — `refactor/remove-ocr`
- [ ] Drop `tesseract.js`
- [ ] Delete the screenshot path: `captureVisibleTab`, `executeScript` injection and its
      retry logic in `background/index.ts`
- [ ] Delete bbox→percentage math (`dpr`, `scrollOffset`, `innerWidth`) and the
      per-word absolutely positioned buttons
- [ ] Drop the `desktopCapture`, `scripting` and `notifications` permissions
- [ ] Replace with a subtitle ring buffer: `MutationObserver` on the caption container,
      keep the last ~5 lines with their `video.currentTime`

Ends with the extension smaller, its permissions harmless, and room for the real
architecture.

### Phase 5 — `refactor/caption-port`

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

- [ ] `CaptionSource` port + registry that picks by `matches(location.href)`
- [ ] `YouTubeCaptionSource` (`.ytp-caption-window-container`)
- [ ] `NetflixCaptionSource` (`.player-timedtext`)
- [ ] Derive the manifest's `content_scripts.matches` and `host_permissions` from the
      adapter registry so platforms are declared in exactly one place

Adding a platform should be one new file plus one line in the registry.

### Phase 6 — `feat/overlay`
- [ ] Remove the `window.alert` override (`createCustomAlert`)
- [ ] Own overlay panel: shortcut → pause → split the buffered line into clickable
      words → show the previous line dimmed above → Esc or close → resume
- [ ] Cut the content script's import of `store.ts` (see defects above); the popup keeps
      it for now

This is the visible face of the project and the weakest part of the old version. Worth
spending time on.

### Phase 7 — `refactor/meaning-port`

```ts
interface MeaningProvider {
  lookup(word: string, sentence: string, targetLang: string): Promise<Meaning>;
}
```

- [ ] `DictionaryApiProvider` — no key, free, context-free (today's behaviour)
- [ ] `LlmProvider` — user's own key, context-aware, structured output
- [ ] Cache in `chrome.storage.local` keyed by (word, sentence)

Keeping both behind one interface means the "do we keep a backend?" decision does not
have to be made now.

**Schema to ask the model for** — the point is not that the model got smarter, it is
what we ask it. Not "what does *run* mean" but "what does *run* mean in *He had to run
the whole department alone*":

```ts
type Meaning = {
  meaningInContext: string;
  translation: string;
  partOfSpeech: string;
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  phrase?: string; // set when the word is part of an idiom / phrasal verb
};
```

`phrase` matters: looking up "run" in isolation silently loses "run into".

### Phase 8 — `feat/settings`
- [ ] Popup settings: target language, provider, API key, shortcut
- [ ] Persist in `chrome.storage.sync`

### Phase 9 — `docs/readme`
- [ ] Rewrite the README from scratch
- [ ] Screen recording of the actual flow
- [ ] Keep the history in it: OCR first, DOM later, and why

## Deferred

- **Word logbook / spaced repetition.** The current in-memory `store.ts` is not a real
  implementation. Revisit after Phase 8, backed by `chrome.storage`.
- **Backend.** `server/VocabularyService` stays untouched until Phase 7 decides whether
  a hosted proxy or a bring-your-own-key model wins.
