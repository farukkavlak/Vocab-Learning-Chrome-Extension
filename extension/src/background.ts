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

    // The content script is declared statically in the manifest, so it is already
    // running on any tab this command can reach.
    await chrome.tabs.sendMessage(tab.id, { type: "LOOKUP_SUBTITLE" });
  })();
});
