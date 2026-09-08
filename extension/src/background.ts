chrome.commands.onCommand.addListener((command) => {
  if (command !== "take-screenshot") {
    return;
  }

  chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
    void (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        return;
      }

      await chrome.tabs.sendMessage(tab.id, { isScreenshot: true, dataUrl });
    })();
  });
});
