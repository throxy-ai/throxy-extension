// Throxy Extension — Background Service Worker
// Removes cal.com and cal.eu entries from browser history so SDRs don't
// accidentally pick the wrong calendar link from the address bar.
//
// This only wakes up when a cal.com/cal.eu page is visited — zero cost at idle.

const CAL_DOMAINS = ["cal.com", "cal.eu"];

async function cleanCalHistory() {
  try {
    let cleaned = 0;
    for (const domain of CAL_DOMAINS) {
      const results = await chrome.history.search({
        text: domain,
        startTime: 0,
        maxResults: 1000,
      });

      for (const item of results) {
        if (item.url && item.url.includes(domain)) {
          await chrome.history.deleteUrl({ url: item.url });
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(
        `[Throxy Background] Cleaned ${cleaned} cal history entries`
      );
    }
  } catch (err) {
    console.warn("[Throxy Background] Error cleaning history:", err);
  }
}

// Clean history whenever a cal.com or cal.eu page finishes loading.
// The service worker wakes up only for this event, runs cleanup, then sleeps.
chrome.webNavigation.onCompleted.addListener(
  (details) => {
    // Small delay so the current page's history entry exists before we delete it
    setTimeout(cleanCalHistory, 2000);
  },
  { url: [{ urlContains: "cal.com" }, { urlContains: "cal.eu" }] }
);

// Also clean once on extension install/update to clear any existing entries
chrome.runtime.onInstalled.addListener(() => {
  cleanCalHistory();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === "cleanCalHistory") {
    setTimeout(cleanCalHistory, 1000);
    return;
  }

  // Proxy fetch requests from content scripts (bypasses CORS via host_permissions)
  if (message && message.action === "proxyFetch") {
    fetch(message.url, {
      method: message.method || "GET",
      headers: message.headers || {},
      body: message.body || undefined,
    })
      .then(async (resp) => {
        const text = await resp.text();
        sendResponse({ ok: resp.ok, status: resp.status, body: text });
      })
      .catch((err) => {
        sendResponse({ ok: false, status: 0, body: err.message });
      });
    return true; // keep sendResponse channel open for async
  }
});
