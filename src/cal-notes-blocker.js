// Cal.com Additional Notes Blocker
// Hides the "Additional notes" field on all cal.com booking pages

(function () {
  "use strict";

  const POLL_INTERVAL = 500;
  const MAX_POLL_TIME = 30000;

  function hideNotesField() {
    // Target the container div by its data attribute
    const container = document.querySelector(
      '[data-fob-field-name="notes"]'
    );
    if (container) {
      container.style.display = "none";
      return true;
    }

    // Fallback: find the textarea by id/name and hide its parent container
    const textarea = document.querySelector(
      'textarea[name="notes"], textarea#notes'
    );
    if (textarea) {
      // Walk up to the .mb-4 container or 3 levels up
      let parent = textarea.closest('[data-fob-field-name="notes"]') ||
        textarea.closest(".mb-4") ||
        textarea.parentElement?.parentElement?.parentElement;
      if (parent) {
        parent.style.display = "none";
        return true;
      }
    }

    return false;
  }

  // Poll until found (cal.com renders dynamically)
  let elapsed = 0;
  const interval = setInterval(() => {
    if (hideNotesField() || elapsed >= MAX_POLL_TIME) {
      clearInterval(interval);
    }
    elapsed += POLL_INTERVAL;
  }, POLL_INTERVAL);

  // Also observe DOM mutations for SPA navigation
  const observer = new MutationObserver(() => {
    hideNotesField();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
