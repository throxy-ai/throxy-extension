// Cal.com Email Deliverability Validator
// Checks emails via BounceBan API and blocks booking submission for undeliverable addresses
// Result values: "deliverable" (allow), "risky" (allow), "undeliverable" (block), "unknown" (allow)

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
      btn.setAttribute("data-throxy-disabled", btn.disabled ? "was-disabled" : "was-enabled");
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
      const prev = btn.getAttribute("data-throxy-disabled");
      btn.disabled = prev === "was-disabled";
      btn.style.opacity = "";
      btn.style.pointerEvents = "";
      btn.removeAttribute("data-throxy-disabled");
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
  async function verifyEmail(email) {
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

    // Basic format check
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      hideBanner();
      clearHighlight();
      unblockSubmit();
      hideLoading();
      lastCheckedEmail = "";
      lastCheckResult = null;
      return;
    }

    // Don't re-check the same email
    if (email === lastCheckedEmail) return;

    lastCheckedEmail = email;
    lastCheckResult = null; // reset — validation pending
    validationInProgress = true;

    if (emailInput) showLoading(emailInput);

    const data = await verifyEmail(email);
    validationInProgress = false;
    hideLoading();

    // If the email changed while we were waiting, discard this result
    const currentEmail = emailInput ? emailInput.value.trim() : "";
    if (currentEmail !== email) return;

    if (!data || data.status !== "success") {
      // API error — don't block, allow through
      lastCheckResult = "unknown";
      hideBanner();
      clearHighlight();
      unblockSubmit();
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
    } else {
      // deliverable, risky, or unknown — allow
      hideBanner();
      clearHighlight();
      unblockSubmit();
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────

  // Keystroke: 5 second debounce (SDRs type slowly, avoid wasting API credits)
  function onEmailInput(e) {
    const email = (e.target.value || "").trim();
    // If they changed the email, reset the result so submit gate knows it's stale
    if (email !== lastCheckedEmail) {
      lastCheckResult = null;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => validateEmail(email), 5000);
  }

  // Paste: validate almost immediately
  function onEmailPaste(e) {
    clearTimeout(debounceTimer);
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

  // ── Submit gate: intercept form submission if email not yet validated ──
  function interceptSubmit(e) {
    const emailInput = getEmailInput();
    if (!emailInput) return; // no email field on this page

    const email = (emailInput.value || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return; // no valid email, let it through

    // If this email hasn't been checked yet, or check is in progress, BLOCK
    if (email !== lastCheckedEmail || lastCheckResult === null || validationInProgress) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log("[Throxy Email Validator] Blocked submit — email not yet validated, running check now");

      // Run the validation now, then re-enable if it passes
      validateEmail(email);
      return;
    }

    // If checked and undeliverable, block
    if (lastCheckResult === "undeliverable") {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log("[Throxy Email Validator] Blocked submit — email is undeliverable");
      return;
    }

    // Otherwise (deliverable, risky, unknown) — allow through
  }

  // Intercept click on the confirm button directly
  function interceptButtonClick(e) {
    const btn = getSubmitButton();
    if (!btn || !btn.contains(e.target)) return;

    const emailInput = getEmailInput();
    if (!emailInput) return;

    const email = (emailInput.value || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    // If email hasn't been validated yet, block the click and trigger validation
    if (email !== lastCheckedEmail || lastCheckResult === null || validationInProgress) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log("[Throxy Email Validator] Blocked button click — validating email first");
      validateEmail(email);
      return false;
    }

    if (lastCheckResult === "undeliverable") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log("[Throxy Email Validator] Blocked button click — undeliverable email");
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

    // If email already has a value (e.g. pre-filled), validate it
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

  // Poll for the email input (cal.com loads forms dynamically)
  const pollInterval = setInterval(() => {
    const emailInput = getEmailInput();
    if (emailInput && !emailInput.hasAttribute("data-throxy-email-bound")) {
      attachListeners();
    }
  }, 1000);

  // Also watch for DOM changes (SPA navigation, form re-renders)
  const observer = new MutationObserver(() => {
    const emailInput = getEmailInput();
    if (emailInput && !emailInput.hasAttribute("data-throxy-email-bound")) {
      attachListeners();
    }
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
