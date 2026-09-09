// Helpers the fake watch page exposes, and the extension API available inside the
// service worker. Neither is typed by anything else in the repo.
declare global {
  interface Window {
    player: HTMLVideoElement;
    showCaption: (segments: string[]) => void;
    clearCaption: () => void;
  }

  const chrome: typeof import("chrome");
}

export {};
