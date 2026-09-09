chrome.commands.onCommand.addListener((command) => {
  if (command !== "lookup-subtitle") {
    return;
  }

  void (async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined) {
      return;
    }

    // Throws when nothing is listening: the tab is not a supported platform, or its
    // content script was orphaned by reloading the extension and needs a page refresh.
    await chrome.tabs
      .sendMessage(tab.id, { type: "LOOKUP_SUBTITLE" })
      .catch(() => undefined);
  })();
});
