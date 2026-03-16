// Cal.com History & Autofill Cleaner
// Removes cal.com browsing history so SDRs can't accidentally pick the wrong calendar link
// Also disables autocomplete on all cal.com form fields to prevent stale pre-fills

(function () {
  "use strict";

  console.log("[Throxy History Cleaner] Loaded on", window.location.href);

  // ── Ask background to clean history immediately on page load ─────
  // This ensures the current cal.com URL gets deleted from history ASAP,
  // so it won't show up as a suggestion on the next address bar search.
  try {
    chrome.runtime.sendMessage({ action: "cleanCalHistory" });
  } catch (e) {
    // Content script may not have messaging access — background handles it anyway
  }

  // ── Disable autocomplete on all form inputs ──────────────────────
  function disableAutocomplete() {
    const inputs = document.querySelectorAll(
      'input:not([data-throxy-autocomplete-off])'
    );
    inputs.forEach((input) => {
      input.setAttribute("autocomplete", "off");
      input.setAttribute("data-throxy-autocomplete-off", "1");
    });

    const forms = document.querySelectorAll(
      'form:not([data-throxy-autocomplete-off])'
    );
    forms.forEach((form) => {
      form.setAttribute("autocomplete", "off");
      form.setAttribute("data-throxy-autocomplete-off", "1");
    });
  }

  // ── Clear pre-filled guest/name fields ───────────────────────────
  // These fields often show data from a previous booking which confuses SDRs
  function clearPrefilled() {
    const nameSelectors = [
      'input[name="name"]',
      'input[name="guests"]',
      '[data-fob-field-name="name"] input',
      '[data-fob-field-name="guests"] input',
      'input[placeholder*="name" i]',
    ];

    for (const sel of nameSelectors) {
      const inputs = document.querySelectorAll(sel);
      inputs.forEach((input) => {
        if (input.hasAttribute("data-throxy-cleared")) return;
        if (input.value && !input.hasAttribute("data-throxy-user-typed")) {
          // Clear the value and dispatch events so React picks it up
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          ).set;
          nativeInputValueSetter.call(input, "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.setAttribute("data-throxy-cleared", "1");
          console.log("[Throxy History Cleaner] Cleared pre-filled field:", sel);
        }
      });
    }
  }

  // Mark fields as user-typed so we don't clear them again
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.target && e.target.tagName === "INPUT") {
        e.target.setAttribute("data-throxy-user-typed", "1");
      }
    },
    true
  );

  // ── Run on load and on SPA navigation ────────────────────────────
  function run() {
    disableAutocomplete();
    clearPrefilled();
  }

  // Poll for new inputs (cal.com is a SPA that re-renders)
  setInterval(run, 1000);

  // Also watch DOM mutations
  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Initial run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
