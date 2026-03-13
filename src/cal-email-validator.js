// Cal.com Email Deliverability Validator
// Confirm button is BLOCKED BY DEFAULT until email is verified as deliverable.
// Result values: "deliverable" (allow), "risky" (allow), "undeliverable" (block), "unknown" (allow on API error)

(function () {
  "use strict";

  const API_KEY = "8380750ddc8eb7c46cfc9baccea21070";
  const API_URL = "https://api.bounceban.com/v1/verify/single";
  const BANNER_ID = "throxy-email-validator-banner";
  const HIGHLIGHT_ATTR = "data-throxy-email-highlight";

  let debounceTimer = null;
  let lastCheckedEmail = "";
  let lastCheckResult = null; // "deliverable", "risky", "undeliverable", "unknown", or null (not checked)
  let isBlocked = false;
  let validationInProgress = false;

  console.log("[Throxy Email Validator] Script loaded on", window.location.href);

  // ── Find email input ──────────────────────────────────────────────
  function getEmailInput() {
    const selectors = [
      'input[name="email"]',
      'input[type="email"]',
      '[data-fob-field-name="email"] input',
      'input[placeholder*="email" i]',
      'input[id*="email" i]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ── Find submit button ────────────────────────────────────────────
  function getSubmitButton() {
    const selectors = [
      'button[type="submit"]',
      '[data-testid="confirm-book-button"]',
      '[data-testid="confirm-button"]',
      'form button:last-of-type',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ── Banner (red error message) ────────────────────────────────────
  function showBanner(message) {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;
      Object.assign(banner.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: "999999",
        background: "#dc2626",
        color: "#fff",
        padding: "14px 20px",
        borderRadius: "8px",
        fontSize: "14px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontWeight: "600",
        lineHeight: "1.5",
        maxWidth: "420px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      });
      document.body.appendChild(banner);
    }
    banner.innerHTML = message;
    banner.style.display = "block";
  }

  function hideBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.style.display = "none";
  }

  // ── Highlight email input red ─────────────────────────────────────
  function highlightEmail(el) {
    if (!el || el.hasAttribute(HIGHLIGHT_ATTR)) return;
    el.setAttribute(HIGHLIGHT_ATTR, el.style.outline || "");
    el.style.outline = "3px solid #dc2626";
  }

  function clearHighlight() {
    document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) => {
      el.style.outline = el.getAttribute(HIGHLIGHT_ATTR);
      el.removeAttribute(HIGHLIGHT_ATTR);
    });
  }

  // ── Block / unblock submit ────────────────────────────────────────
  function blockSubmit() {
    if (isBlocked) return;
    isBlocked = true;

    const btn = getSubmitButton();
    if (btn) {
      btn.setAttribute("data-throxy-disabled", "1");
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }
  }

  function unblockSubmit() {
    if (!isBlocked) return;
    isBlocked = false;

    const btn = getSubmitButton();
    if (btn && btn.hasAttribute("data-throxy-disabled")) {
      btn.disabled = false;
      btn.style.opacity = "";
      btn.style.pointerEvents = "";
      btn.removeAttribute("data-throxy-disabled");
    }
  }

  // Keep the button blocked as the page re-renders (cal.com is a SPA)
  function enforceBlockState() {
    const btn = getSubmitButton();
    if (!btn) return;

    const emailInput = getEmailInput();
    const email = emailInput ? (emailInput.value || "").trim() : "";
    const isValidFormat = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isVerified = isValidFormat && email === lastCheckedEmail && lastCheckResult !== null && lastCheckResult !== "undeliverable" && !validationInProgress;

    if (isVerified) {
      // Email is verified and OK — make sure button is enabled
      if (btn.hasAttribute("data-throxy-disabled")) {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.style.pointerEvents = "";
        btn.removeAttribute("data-throxy-disabled");
        isBlocked = false;
      }
    } else {
      // Not verified yet — keep button blocked
      if (!btn.hasAttribute("data-throxy-disabled")) {
        btn.setAttribute("data-throxy-disabled", "1");
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
        isBlocked = true;
      }
    }
  }

  // ── Loading indicator ─────────────────────────────────────────────
  function showLoading(emailInput) {
    let indicator = document.getElementById("throxy-email-loading");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "throxy-email-loading";
      Object.assign(indicator.style, {
        fontSize: "12px",
        color: "#6b7280",
        marginTop: "4px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      });
      const container =
        emailInput.closest('[data-fob-field-name="email"]') ||
        emailInput.parentElement;
      if (container) container.appendChild(indicator);
    }
    indicator.textContent = "Verifying email…";
    indicator.style.display = "block";
  }

  function hideLoading() {
    const el = document.getElementById("throxy-email-loading");
    if (el) el.style.display = "none";
  }

  // ── BounceBan API call ────────────────────────────────────────────
  async function callApi(email) {
    const url = `${API_URL}?api_key=${API_KEY}&email=${encodeURIComponent(email)}`;
    try {
      console.log("[Throxy Email Validator] Calling API for:", email);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      console.log("[Throxy Email Validator] API response:", data);
      return data;
    } catch (err) {
      console.warn("[Throxy Email Validator] API error:", err);
      return null;
    }
  }

  // ── Main validation logic ─────────────────────────────────────────
  async function validateEmail(email) {
    const emailInput = getEmailInput();

    // Basic format check — if invalid, keep blocked
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      hideBanner();
      clearHighlight();
      hideLoading();
      lastCheckedEmail = "";
      lastCheckResult = null;
      blockSubmit();
      return;
    }

    // Don't re-check the same email
    if (email === lastCheckedEmail && lastCheckResult !== null) return;

    lastCheckedEmail = email;
    lastCheckResult = null; // reset — validation pending
    validationInProgress = true;
    blockSubmit(); // ensure blocked while checking

    if (emailInput) showLoading(emailInput);

    const data = await callApi(email);
    validationInProgress = false;
    hideLoading();

    // If the email changed while we were waiting, discard this result
    const currentEmail = emailInput ? emailInput.value.trim() : "";
    if (currentEmail !== email) return;

    if (!data || data.status !== "success") {
      // API error — allow through (don't punish SDR for API issues)
      lastCheckResult = "unknown";
      hideBanner();
      clearHighlight();
      unblockSubmit();
      console.log("[Throxy Email Validator] API error/timeout — allowing through");
      return;
    }

    const result = (data.result || "").toLowerCase();
    lastCheckResult = result;

    if (result === "undeliverable") {
      showBanner(
        "⛔ This email is undeliverable<br>" +
          '<span style="font-weight:400;font-size:13px;">' +
          "Please call the prospect again to get a correct email address.</span>"
      );
      if (emailInput) {
        const container =
          emailInput.closest('[data-fob-field-name="email"]') ||
          emailInput.parentElement;
        highlightEmail(container || emailInput);
      }
      blockSubmit();
      console.log("[Throxy Email Validator] BLOCKED — undeliverable email");
    } else {
      // deliverable, risky, or unknown — UNBLOCK
      hideBanner();
      clearHighlight();
      unblockSubmit();
      console.log("[Throxy Email Validator] ALLOWED —", result);
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────

  // Keystroke: 5 second debounce
  function onEmailInput(e) {
    const email = (e.target.value || "").trim();
    if (email !== lastCheckedEmail) {
      lastCheckResult = null;
      blockSubmit(); // re-block on any change
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => validateEmail(email), 5000);
  }

  // Paste: validate almost immediately
  function onEmailPaste(e) {
    clearTimeout(debounceTimer);
    blockSubmit();
    setTimeout(() => {
      const email = (e.target.value || "").trim();
      validateEmail(email);
    }, 100);
  }

  // Blur / change: validate immediately when user leaves the field
  function onEmailBlur(e) {
    clearTimeout(debounceTimer);
    const email = (e.target.value || "").trim();
    if (email) validateEmail(email);
  }

  // ── Submit safety net (capture phase) ──
  function interceptSubmit(e) {
    const emailInput = getEmailInput();
    if (!emailInput) return;

    const email = (emailInput.value || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const isVerified = email === lastCheckedEmail && lastCheckResult !== null && lastCheckResult !== "undeliverable" && !validationInProgress;

    if (!isVerified) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log("[Throxy Email Validator] Blocked form submit — email not verified");
      if (email !== lastCheckedEmail || lastCheckResult === null) {
        validateEmail(email);
      }
    }
  }

  function interceptButtonClick(e) {
    const btn = getSubmitButton();
    if (!btn || !btn.contains(e.target)) return;

    const emailInput = getEmailInput();
    if (!emailInput) return;

    const email = (emailInput.value || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const isVerified = email === lastCheckedEmail && lastCheckResult !== null && lastCheckResult !== "undeliverable" && !validationInProgress;

    if (!isVerified) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log("[Throxy Email Validator] Blocked button click — email not verified");
      if (email !== lastCheckedEmail || lastCheckResult === null) {
        validateEmail(email);
      }
      return false;
    }
  }

  function attachListeners() {
    const emailInput = getEmailInput();
    if (!emailInput || emailInput.hasAttribute("data-throxy-email-bound")) return;

    console.log("[Throxy Email Validator] Found email input, attaching listeners");
    emailInput.setAttribute("data-throxy-email-bound", "1");
    emailInput.addEventListener("input", onEmailInput);
    emailInput.addEventListener("paste", onEmailPaste);
    emailInput.addEventListener("change", onEmailBlur);
    emailInput.addEventListener("blur", onEmailBlur);

    // BLOCK submit button immediately on attach — unblocked only after verification
    blockSubmit();

    // If email already has a value (e.g. pre-filled), validate it immediately
    const existing = emailInput.value.trim();
    if (existing) validateEmail(existing);
  }

  // ── Global submit/click interceptors (capture phase = fires first) ──
  document.addEventListener("submit", interceptSubmit, true);
  document.addEventListener("click", interceptButtonClick, true);

  // ── Initialization: poll + MutationObserver for SPA navigation ────
  function init() {
    attachListeners();
  }

  // Poll for the email input AND enforce block state (cal.com re-renders buttons)
  const pollInterval = setInterval(() => {
    const emailInput = getEmailInput();
    if (emailInput && !emailInput.hasAttribute("data-throxy-email-bound")) {
      attachListeners();
    }
    // Re-enforce block state every poll in case cal.com re-rendered the button
    enforceBlockState();
  }, 1000);

  // Also watch for DOM changes (SPA navigation, form re-renders)
  const observer = new MutationObserver(() => {
    const emailInput = getEmailInput();
    if (emailInput && !emailInput.hasAttribute("data-throxy-email-bound")) {
      attachListeners();
    }
    enforceBlockState();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Initial attempt
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
