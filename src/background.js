// Throxy Extension — Background Service Worker
// Removes cal.com entries from browser history so SDRs don't
// accidentally pick the wrong calendar link from the address bar.
//
// This only wakes up when a cal.com page is visited — zero cost at idle.

async function cleanCalHistory() {
  try {
    const results = await chrome.history.search({
      text: "cal.com",
      startTime: 0,
      maxResults: 1000,
    });

    let cleaned = 0;
    for (const item of results) {
      if (item.url && item.url.includes("cal.com")) {
        await chrome.history.deleteUrl({ url: item.url });
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(
        `[Throxy Background] Cleaned ${cleaned} cal.com history entries`
      );
    }
  } catch (err) {
    console.warn("[Throxy Background] Error cleaning history:", err);
  }
}

// Clean history whenever a cal.com page finishes loading.
// The service worker wakes up only for this event, runs cleanup, then sleeps.
chrome.webNavigation.onCompleted.addListener(
  (details) => {
    // Small delay so the current page's history entry exists before we delete it
    setTimeout(cleanCalHistory, 2000);
  },
  { url: [{ urlContains: "cal.com" }] }
);

// Also clean once on extension install/update to clear any existing entries
chrome.runtime.onInstalled.addListener(() => {
  cleanCalHistory();
});

// Listen for cleanup requests from content scripts
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.action === "cleanCalHistory") {
    setTimeout(cleanCalHistory, 1000);
  }
});
