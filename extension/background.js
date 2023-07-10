chrome.commands.onCommand.addListener(function (command) {
	if (command === "take-screenshot") {
		  chrome.tabs.captureVisibleTab(null, {format: "png"}, async function(dataUrl) {
			const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
			chrome.tabs.sendMessage(tab.id, { isScreenshot: true, dataUrl: dataUrl });
		  });
	}
});
