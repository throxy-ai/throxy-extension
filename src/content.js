/**
 * CloudTalk Disposition Shortcuts + Schedule Awareness + Headset Mic Warning
 * + LinkedIn Prospect Panel (A/B test)
 *
 * SHORTCUTS:
 *   0:            Hang up the call
 *   1-9:          Select disposition 1-9
 *   Q:            Select disposition 10
 *   W:            Select disposition 11
 *   E:            Select disposition 12
 *   +:            Next Call (Plus key)
 *   Ctrl+Shift+L: Toggle LinkedIn prospect panel (A/B test)
 *
 * SCHEDULE AWARENESS (non-blocking):
 *   Shows status banner with current block info.
 *   During breaks: prominent warning banner asking user to exit campaign
 *   (for list refresh). Calling is NEVER blocked.
 *
 * HEADSET MIC WARNING:
 *   Detects if the default microphone is Realtek (laptop built-in).
 *   Shows a persistent warning (non-blocking).
 *
 * LINKEDIN PANEL (A/B test with remote whitelist):
 *   Embeds the prospect's LinkedIn profile inline in the activity column
 *   via iframe. declarativeNetRequest strips framing headers. Access is
 *   controlled by a remote config.json whitelist on GitHub Pages.
 *   Links inside the iframe are blocked (sandbox). Layout auto-compresses
 *   left panels to give LinkedIn more space. Ctrl+Shift+L to toggle.
 */

(function() {
  'use strict';

  // ================================================================
  // MORNING SCHEDULE (dark blocks on timetable)
  // Day: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // ================================================================
  const WEEKDAY_MORNING = [
    { start: '10:15', end: '11:15' },
    { start: '11:30', end: '13:00' },
    { start: '14:15', end: '15:15' },
    { start: '15:30', end: '16:30' },
    { start: '17:00', end: '17:45' },
    { start: '18:00', end: '19:00' },
  ];

  const MORNING_SCHEDULE = {
    0: [],
    1: WEEKDAY_MORNING,
    2: WEEKDAY_MORNING,
    3: WEEKDAY_MORNING,
    4: WEEKDAY_MORNING,
    5: WEEKDAY_MORNING,
    6: [],
  };

  // ================================================================
  // AFTERNOON SCHEDULE (purple blocks on timetable)
  // ================================================================
  const WEEKDAY_AFTERNOON = [
    { start: '13:00', end: '14:00' },
    { start: '14:15', end: '15:15' },
    { start: '15:30', end: '16:30' },
    { start: '16:45', end: '18:15' },
    { start: '19:30', end: '20:30' },
    { start: '20:45', end: '21:30' },
  ];

  const AFTERNOON_SCHEDULE = {
    0: [],
    1: WEEKDAY_AFTERNOON,
    2: WEEKDAY_AFTERNOON,
    3: WEEKDAY_AFTERNOON,
    4: WEEKDAY_AFTERNOON,
    5: WEEKDAY_AFTERNOON,
    6: [],
  };

  const CURRENT_VERSION = '1.8.3';
  const UPDATE_XML_URL = 'https://cloudtalk-extension.throxy.ai/updates.xml';
  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const CHECK_INTERVAL_MS = 5000;
  const MIC_CHECK_INTERVAL_MS = 15000;
  const LINKEDIN_POLL_MS = 3000;
  const CONFIG_URL = 'https://cloudtalk-extension.throxy.ai/config.json';
  const CONFIG_FETCH_INTERVAL_MS = 10 * 60 * 1000;
  const IS_TOP_FRAME = (window.self === window.top);
  const BATCH_STORAGE_KEY = 'ct-batch-selection';
  const LINKEDIN_PANEL_KEY = 'ct-linkedin-panel';
  const LINKEDIN_USER_KEY = 'ct-linkedin-user-email';
  const ONEPAGER_PANEL_KEY = 'ct-onepager-panel';
  const ONEPAGER_BASE_URL = 'https://leadflow.throxy.com/one-pager/';

  // ================================================================
  // STATE
  // ================================================================
  let lastBadgeUpdate = 0;
  let isProcessing = false;
  const DEBOUNCE_MS = 500;
  let isMicBlocked = false;
  let selectedBatch = null; // 'Morning' or 'Afternoon', null = not chosen today
  let breakWarningDismissed = false; // reset when break period changes
  let lastBreakKey = null;           // tracks which break period was dismissed
  let micWarningDismissed = false;   // user closed the mic warning
  let currentLinkedInUrl = null;     // tracks current prospect's LinkedIn URL
  let linkedInWhitelist = null;      // null = config not fetched yet; string[] = whitelist loaded
  let onePagerWhitelist = null;      // null = config not fetched yet; string[] = whitelist loaded
  let onePagerMap = null;            // null = config not fetched; { clientName: sheetUUID }
  let currentOnePagerId = null;      // tracks current one-pager sheet UUID

  function log(...args) {
    console.log('[CloudTalk Shortcuts]', ...args);
  }

  if (IS_TOP_FRAME) {
    const linkedInStatus = isLinkedInPanelEnabled() ? 'ON' : 'OFF (Ctrl+Shift+L to enable)';
    console.log('===========================================');
    console.log('[CloudTalk Shortcuts] EXTENSION LOADED!');
    console.log('[CloudTalk Shortcuts] Shortcuts:');
    console.log('  0            = Hang up');
    console.log('  1-9          = Disposition 1-9');
    console.log('  Q/W/E        = Disposition 10/11/12');
    console.log('  +            = Next Call');
    console.log('  Ctrl+Shift+L = Toggle LinkedIn panel');
    console.log('[CloudTalk Shortcuts] Schedule warnings: ACTIVE');
    console.log('[CloudTalk Shortcuts] Headset mic warning: ACTIVE');
    console.log('[CloudTalk Shortcuts] LinkedIn panel:', linkedInStatus);
    console.log('===========================================');
  }

  // ================================================================
  // SHIFT SELECTION — localStorage persistence
  // ================================================================

  const DAY_START_HOUR = 7; // Day boundary: 7 AM. Before this = still "yesterday".

  function todayDateStr() {
    const d = new Date();
    if (d.getHours() < DAY_START_HOUR) {
      d.setDate(d.getDate() - 1);
    }
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function getEffectiveDay() {
    const now = new Date();
    if (now.getHours() < DAY_START_HOUR) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.getDay();
    }
    return now.getDay();
  }

  function loadBatchSelection() {
    try {
      const raw = localStorage.getItem(BATCH_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.date === todayDateStr() && (data.batch === 'Morning' || data.batch === 'Afternoon')) {
        return data.batch;
      }
      return null; // expired (different day)
    } catch (_) {
      return null;
    }
  }

  function saveBatchSelection(batch) {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify({
      date: todayDateStr(),
      batch: batch,
    }));
  }

  function selectBatch(batch) {
    selectedBatch = batch;
    saveBatchSelection(batch);
    log('Shift selected:', batch);
    hideBatchSelectorOverlay();
    enforceTimeBlocks();
  }

  function getActiveSchedule() {
    if (selectedBatch === 'Morning') return MORNING_SCHEDULE;
    if (selectedBatch === 'Afternoon') return AFTERNOON_SCHEDULE;
    return null;
  }

  // ================================================================
  // URL SCOPE
  // ================================================================

  function isSessionPage() {
    const path = window.location.pathname;
    return /^\/p\/dialer\/campaigns\/\d+\/session/.test(path);
  }

  function isCampaignPage() {
    const path = window.location.pathname;
    return /^\/p\/dialer\/campaigns(\/\d+)?$/.test(path);
  }

  function isBlockablePage() {
    return isSessionPage();
  }

  // ================================================================
  // TIME UTILITIES
  // ================================================================

  function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  function formatTime(date) {
    return date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0');
  }

  function formatTimeWithSeconds(date) {
    return formatTime(date) + ':' + date.getSeconds().toString().padStart(2, '0');
  }

  function getCurrentBlockStatus() {
    const schedule = getActiveSchedule();
    const now = new Date();
    const dayOfWeek = getEffectiveDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (!schedule) {
      return {
        isBreak: true,
        currentBlock: null,
        nextBlock: null,
        minutesRemaining: 0,
        minutesToNextBlock: null,
        currentTime: formatTime(now),
        currentTimeWithSeconds: formatTimeWithSeconds(now),
        message: 'Select your shift (Morning or Afternoon)',
        noBatchSelected: true,
      };
    }

    const blocks = schedule[dayOfWeek] || [];

    if (blocks.length === 0) {
      return {
        isBreak: true,
        currentBlock: null,
        nextBlock: null,
        minutesRemaining: 0,
        minutesToNextBlock: null,
        currentTime: formatTime(now),
        currentTimeWithSeconds: formatTimeWithSeconds(now),
        message: 'No blocks scheduled today',
      };
    }

    const lastBlock = blocks[blocks.length - 1];
    const lastEnd = timeToMinutes(lastBlock.end);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const start = timeToMinutes(block.start);
      const end = timeToMinutes(block.end);
      if (currentMinutes >= start && currentMinutes <= end) {
        const isLast = (i === blocks.length - 1);
        return {
          isBreak: false,
          isLastBlock: isLast,
          isFreeCalling: false,
          currentBlock: block,
          nextBlock: null,
          minutesRemaining: end - currentMinutes,
          minutesToNextBlock: null,
          currentTime: formatTime(now),
          currentTimeWithSeconds: formatTimeWithSeconds(now),
          message: isLast
            ? `Last block: ${block.start}\u2013${block.end} \u00B7 Free calling after`
            : `Active: ${block.start}\u2013${block.end}`,
        };
      }
    }

    // Past the last block of the day — FREE CALLING mode
    if (currentMinutes > lastEnd) {
      return {
        isBreak: false,
        isLastBlock: true,
        isFreeCalling: true,
        currentBlock: null,
        nextBlock: null,
        minutesRemaining: 0,
        minutesToNextBlock: null,
        currentTime: formatTime(now),
        currentTimeWithSeconds: formatTimeWithSeconds(now),
        message: 'Free calling \u2014 all blocks completed',
      };
    }

    // Between blocks (not the last) — still a break
    let nextBlock = null;
    let minDiff = Infinity;
    for (const block of blocks) {
      const start = timeToMinutes(block.start);
      const diff = start - currentMinutes;
      if (diff > 0 && diff < minDiff) {
        minDiff = diff;
        nextBlock = block;
      }
    }

    const firstBlock = blocks[0];
    const firstStart = timeToMinutes(firstBlock.start);

    let message;
    if (currentMinutes < firstStart) {
      message = `Day starts at ${firstBlock.start}`;
    } else {
      message = nextBlock
        ? `Next block: ${nextBlock.start}\u2013${nextBlock.end}`
        : 'Break';
    }

    return {
      isBreak: true,
      isLastBlock: false,
      isFreeCalling: false,
      currentBlock: null,
      nextBlock: nextBlock,
      minutesRemaining: 0,
      minutesToNextBlock: nextBlock ? timeToMinutes(nextBlock.start) - currentMinutes : null,
      currentTime: formatTime(now),
      currentTimeWithSeconds: formatTimeWithSeconds(now),
      message: message,
    };
  }

  function isCallActive() {
    const hangupSelectors = [
      'app-button.hangup',
      '.control-btn.hangup',
      'app-button.control-btn.hangup',
    ];
    for (const sel of hangupSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    }
    const timer = document.querySelector('.call-timer, [class*="call-timer"], [class*="call-duration"]');
    if (timer && timer.offsetParent !== null && timer.textContent.trim().length > 0) return true;
    return false;
  }

  function isCallConnected() {
    const timer = document.querySelector('.call-timer, [class*="call-timer"], [class*="call-duration"]');
    if (!timer || timer.offsetParent === null) return false;
    const text = timer.textContent.trim();
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(text);
  }

  // ================================================================
  // MICROPHONE WARNING
  // ================================================================

  async function checkMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      log('MediaDevices API not available \u2014 skipping mic check');
      isMicBlocked = false;
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      if (audioInputs.length === 0) {
        isMicBlocked = true;
        if (IS_TOP_FRAME) showMicWarning('No microphone detected. Please connect your headset.');
        return;
      }

      const hasLabels = audioInputs.some(d => d.label.length > 0);
      if (!hasLabels) {
        let permDenied = false;
        try {
          const permStatus = await navigator.permissions.query({ name: 'microphone' });
          permDenied = (permStatus.state === 'denied');
        } catch (_) {}

        if (permDenied) {
          isMicBlocked = true;
          if (IS_TOP_FRAME) showMicWarning(
            'Microphone permission is BLOCKED in Chrome. Click the lock icon in the address bar \u2192 Site settings \u2192 Allow Microphone.'
          );
          log('Mic blocked \u2014 permission denied in Chrome');
        } else {
          log('Device labels not available yet \u2014 skipping mic check');
          isMicBlocked = false;
          if (IS_TOP_FRAME) hideMicWarning();
        }
        return;
      }

      const defaultDevice = audioInputs.find(d => d.deviceId === 'default');
      const commsDevice = audioInputs.find(d => d.deviceId === 'communications');

      const isRealtekDefault = defaultDevice &&
        defaultDevice.label.toLowerCase().includes('realtek');
      const isRealtekComms = commsDevice &&
        commsDevice.label.toLowerCase().includes('realtek');

      const hasHeadset = audioInputs.some(d => {
        if (d.deviceId === 'default' || d.deviceId === 'communications') return false;
        if (d.label === '') return false;
        const lbl = d.label.toLowerCase();
        return !lbl.includes('realtek') &&
               !lbl.includes('built-in') &&
               !lbl.includes('internal');
      });

      if (isRealtekDefault || isRealtekComms) {
        isMicBlocked = true;
        if (hasHeadset) {
          if (IS_TOP_FRAME) showMicWarning(
            'Your default microphone is Realtek (laptop mic). Switch to your headset in system sound settings.'
          );
        } else {
          if (IS_TOP_FRAME) showMicWarning(
            'No headset microphone detected. Please connect your headset before making calls.'
          );
        }
        log('Mic blocked \u2014 Realtek detected as default');
      } else {
        isMicBlocked = false;
        if (IS_TOP_FRAME) hideMicWarning();
        log('Mic OK \u2014 headset detected');
      }
    } catch (e) {
      log('Microphone check error:', e);
      isMicBlocked = false;
    }
  }

  // ================================================================
  // STYLES
  // ================================================================

  function addStyles() {
    if (document.getElementById('ct-shortcut-styles')) return;

    const style = document.createElement('style');
    style.id = 'ct-shortcut-styles';
    style.textContent = `
      /* === Shortcut Badges === */
      .ct-shortcut-badge {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 18px; height: 18px; padding: 0 5px; margin-left: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 10px; font-weight: 600; color: #fff;
        background: rgba(0,0,0,0.6); border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        pointer-events: none; flex-shrink: 0;
      }
      .ct-shortcut-badge-primary { background: rgba(51,79,255,0.85); }
      .ct-shortcut-badge-danger  { background: rgba(252,61,71,0.85); }
      cds-call-disposition .cds-chip {
        display: inline-flex !important; align-items: center !important;
        min-height: 38px !important; padding: 6px 16px !important;
        font-size: 14px !important; font-weight: 500 !important;
      }
      .ct-disposition-selected { border: 2px solid #00ff00 !important; box-shadow: 0 0 10px #00ff00 !important; }

      /* Hide activity content when LinkedIn panel replaces it */
      app-session-activity[data-ct-linkedin-active] > *:not(#ct-linkedin-card) {
        display: none !important;
      }

      /* === Compact layout: shrink left panels when LinkedIn is active === */
      [data-ct-compact="0"] {
        max-width: 170px !important;
        flex: 0 0 170px !important;
        min-width: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      [data-ct-compact="1"] {
        max-width: 220px !important;
        flex: 0 0 220px !important;
        min-width: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      app-session-activity[data-ct-linkedin-active] {
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }

      /* === LinkedIn Inline Panel (inside activity column) === */
      #ct-linkedin-card {
        display: flex !important; flex-direction: column;
        height: 100%; overflow: hidden;
      }
      #ct-linkedin-card .ct-li-header {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; background: #0a66c2; color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 12px; font-weight: 600; flex-shrink: 0;
        letter-spacing: 0.3px;
      }
      #ct-linkedin-card .ct-li-header svg { flex-shrink: 0; }
      #ct-linkedin-card .ct-li-url {
        flex: 1; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; opacity: 0.85; font-weight: 400;
        font-size: 11px;
      }
      #ct-linkedin-card .ct-li-iframe {
        flex: 1; width: 100%; border: none; background: #f8fafc;
      }
      #ct-linkedin-card .ct-li-empty {
        flex: 1; display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 12px; padding: 32px;
        color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 13px; text-align: center;
      }
      #ct-linkedin-card .ct-li-empty svg { opacity: 0.4; }
      #ct-linkedin-card .ct-li-waiting {
        flex: 1; display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 12px; padding: 32px;
        color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 13px; text-align: center;
      }
      #ct-linkedin-card .ct-li-waiting svg { opacity: 0.4; }
      #ct-linkedin-card .ct-li-loading {
        flex: 1; display: flex; align-items: center; justify-content: center;
      }
      #ct-linkedin-card .ct-li-spinner {
        width: 24px; height: 24px; border: 3px solid #e2e8f0;
        border-top-color: #0a66c2; border-radius: 50%;
        animation: ct-li-spin 0.8s linear infinite;
      }
      @keyframes ct-li-spin { to { transform: rotate(360deg); } }

      /* === Status Banner (centered pill, doesn't cover header) === */
      #ct-time-status {
        position: fixed; top: 6px; left: 50%; transform: translateX(-50%);
        height: 30px; padding: 0 18px;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 11px; font-weight: 600; z-index: 99998;
        transition: background-color 0.3s ease;
        box-shadow: 0 2px 12px rgba(0,0,0,0.25); letter-spacing: 0.3px;
        border-radius: 20px; white-space: nowrap;
        pointer-events: none;
      }
      #ct-time-status.ct-status-active { background: #15803d; color: #fff; }
      #ct-time-status.ct-status-break {
        background: #dc2626; color: #fff;
        animation: ct-pulse-bg 1.5s ease-in-out infinite;
      }
      #ct-time-status.ct-status-nobatch { background: #334fff; color: #fff; }
      #ct-time-status.ct-status-free { background: #0d9488; color: #fff; }
      @keyframes ct-pulse-bg {
        0%, 100% { background: #dc2626; }
        50%      { background: #991b1b; }
      }
      #ct-time-status .ct-dot {
        width: 7px; height: 7px; border-radius: 50%;
        display: inline-block; flex-shrink: 0;
      }
      #ct-time-status.ct-status-active .ct-dot {
        background: #86efac; animation: ct-dot-blink 2s ease-in-out infinite;
      }
      #ct-time-status.ct-status-break .ct-dot {
        background: #fca5a5; animation: ct-dot-blink 1s ease-in-out infinite;
      }
      #ct-time-status.ct-status-nobatch .ct-dot {
        background: #93a5ff; animation: ct-dot-blink 1s ease-in-out infinite;
      }
      #ct-time-status.ct-status-free .ct-dot {
        background: #5eead4; animation: ct-dot-blink 2s ease-in-out infinite;
      }
      @keyframes ct-dot-blink {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.3; }
      }

      /* === Shift Tag in Banner === */
      .ct-shift-tag {
        display: inline-flex; align-items: center; gap: 4px;
        background: rgba(255,255,255,0.15); border-radius: 4px;
        padding: 1px 8px; font-size: 11px; font-weight: 700;
        letter-spacing: 0.5px; margin-right: 4px;
      }

      /* === Shift Selector Overlay (leaves session header visible) === */
      #ct-batch-selector {
        position: fixed; top: 90px; left: 0; right: 0; bottom: 64px;
        background: rgba(22, 27, 51, 0.95); z-index: 99997;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(10px);
        animation: ct-sel-fadein 0.25s ease;
        border-radius: 12px 12px 0 0;
      }
      @keyframes ct-sel-fadein {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .ct-batch-card {
        background: #fff; border-radius: 16px;
        padding: 40px 44px 36px; max-width: 420px; width: 88%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(51,79,255,0.08);
        animation: ct-sel-slidein 0.3s ease;
      }
      @keyframes ct-sel-slidein {
        from { transform: translateY(16px) scale(0.97); opacity: 0; }
        to   { transform: translateY(0) scale(1); opacity: 1; }
      }
      .ct-batch-card .ct-batch-logo {
        width: 40px; height: 40px; margin: 0 auto 16px;
        background: #334fff; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; color: #fff;
      }
      .ct-batch-card .ct-batch-title {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
        font-size: 20px; font-weight: 700; color: #161b33;
        margin-bottom: 6px;
      }
      .ct-batch-card .ct-batch-subtitle {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 13px; color: #6b7280; margin-bottom: 32px; line-height: 1.5;
      }
      .ct-batch-card .ct-batch-buttons {
        display: flex; gap: 12px; justify-content: center;
      }
      .ct-batch-pick {
        flex: 1; padding: 18px 12px; border: 2px solid #e5e7eb; border-radius: 12px;
        background: #fff; color: #161b33; cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 15px; font-weight: 600; transition: all 0.2s ease;
        display: flex; flex-direction: column; align-items: center; gap: 8px;
      }
      .ct-batch-pick .ct-pick-icon {
        width: 44px; height: 44px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; background: #f3f4f6;
        transition: all 0.2s ease;
      }
      .ct-batch-pick:hover {
        border-color: #334fff; background: #f0f3ff;
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(51,79,255,0.15);
      }
      .ct-batch-pick:hover .ct-pick-icon {
        background: #334fff; color: #fff;
      }
      .ct-batch-pick:active { transform: translateY(0); }
      .ct-batch-card .ct-batch-lock-note {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 11px; color: #9ca3af; margin-top: 20px; line-height: 1.4;
      }

      /* === Dismiss Button (shared) === */
      .ct-dismiss-btn {
        position: absolute; top: 6px; right: 8px;
        width: 22px; height: 22px; border: none; border-radius: 50%;
        background: rgba(255,255,255,0.2); color: #fff;
        font-size: 14px; font-weight: 700; line-height: 1;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.15s ease;
        pointer-events: auto;
      }
      .ct-dismiss-btn:hover { background: rgba(255,255,255,0.4); }

      /* === Mic Warning Banner (centered pill) === */
      #ct-mic-warning {
        position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
        height: 28px; padding: 0 32px 0 16px;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 11px; font-weight: 600; z-index: 99998;
        background: #d97706; color: #fff;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2); letter-spacing: 0.2px;
        border-radius: 16px; white-space: nowrap;
      }
      #ct-mic-warning .ct-mic-icon { font-size: 14px; }
      #ct-mic-warning .ct-dismiss-btn { top: 3px; right: 4px; width: 20px; height: 20px; font-size: 12px; }

      /* === Break Warning Banner (prominent, non-blocking, dismissible) === */
      #ct-break-warning {
        position: fixed; top: 44px; left: 50%; transform: translateX(-50%);
        width: 90%; max-width: 620px;
        background: linear-gradient(135deg, #dc2626, #991b1b);
        color: #fff; padding: 16px 40px 16px 32px; border-radius: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 16px; font-weight: 700; z-index: 99999;
        box-shadow: 0 8px 32px rgba(220,38,38,0.5), 0 0 0 2px rgba(255,255,255,0.1);
        animation: ct-warn-in 0.3s ease, ct-warn-pulse 2s ease-in-out infinite;
        text-align: center; line-height: 1.5;
        letter-spacing: 0.3px;
      }
      #ct-break-warning .ct-warn-title {
        font-size: 18px; font-weight: 800; text-transform: uppercase;
        letter-spacing: 2px; margin-bottom: 4px;
      }
      #ct-break-warning .ct-warn-subtitle {
        font-size: 13px; font-weight: 500; opacity: 0.9;
      }
      @keyframes ct-warn-in {
        from { transform: translateX(-50%) translateY(-16px); opacity: 0; }
        to   { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes ct-warn-pulse {
        0%, 100% { box-shadow: 0 8px 32px rgba(220,38,38,0.5), 0 0 0 2px rgba(255,255,255,0.1); }
        50%      { box-shadow: 0 8px 40px rgba(220,38,38,0.7), 0 0 0 3px rgba(255,255,255,0.2); }
      }

      /* === Update Available Banner === */
      #ct-update-banner {
        position: fixed; bottom: 0; left: 0; right: 0;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: #fff; padding: 10px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 13px; font-weight: 600; z-index: 100001;
        display: flex; align-items: center; justify-content: center; gap: 12px;
        box-shadow: 0 -4px 20px rgba(79,70,229,0.4);
        animation: ct-update-slidein 0.4s ease;
      }
      #ct-update-banner .ct-update-text { letter-spacing: 0.3px; }
      #ct-update-banner .ct-update-version {
        background: rgba(255,255,255,0.2); border-radius: 4px;
        padding: 2px 8px; font-size: 11px; font-weight: 700;
      }
      #ct-update-banner .ct-update-action {
        background: #fff; color: #4f46e5; border: none; border-radius: 6px;
        padding: 6px 16px; font-size: 12px; font-weight: 700; cursor: pointer;
        transition: all 0.15s ease;
      }
      #ct-update-banner .ct-update-action:hover {
        background: #e0e7ff; transform: translateY(-1px);
      }
      @keyframes ct-update-slidein {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // ================================================================
  // BADGE UI
  // ================================================================

  function createBadge(key, type = 'default') {
    const badge = document.createElement('span');
    badge.className = 'ct-shortcut-badge';
    if (type === 'primary') badge.classList.add('ct-shortcut-badge-primary');
    if (type === 'danger') badge.classList.add('ct-shortcut-badge-danger');
    badge.textContent = key;
    badge.setAttribute('data-ct-badge', 'true');
    return badge;
  }

  function removeActivitySection() {
    const activityHost = document.querySelector('app-session-activity');
    if (activityHost) {
      const children = activityHost.querySelectorAll(':scope > *:not(#ct-linkedin-card)');
      children.forEach(el => el.remove());
    }
    const selectors = [
      '.activity:not(app-session-activity)',
      'app-activity',
      '[class*="activity-list"]',
      '[class*="activity-feed"]',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.closest('app-session-activity') && (el.offsetParent !== null || el.parentElement)) {
          el.remove();
        }
      });
    }
  }

  // ================================================================
  // LINKEDIN PROSPECT PANEL (A/B test — opt-in via Ctrl+Shift+L)
  // ================================================================

  function isLinkedInPanelEnabled() {
    return localStorage.getItem(LINKEDIN_PANEL_KEY) === 'enabled';
  }

  function toggleLinkedInPanel() {
    if (linkedInWhitelist !== null) {
      let email = detectAgentEmail();
      if (!email) {
        const input = prompt('Enter your CloudTalk email to verify access:');
        if (!input) return;
        email = input.toLowerCase().trim();
        localStorage.setItem(LINKEDIN_USER_KEY, email);
      }
      const whitelisted = isUserWhitelisted();
      if (whitelisted === false) {
        showNotification('LinkedIn preview is not enabled for your account', 'error');
        return;
      }
    }

    const wasEnabled = isLinkedInPanelEnabled();
    if (wasEnabled) {
      localStorage.removeItem(LINKEDIN_PANEL_KEY);
      removeLinkedInPanel();
      showNotification('LinkedIn panel disabled', 'success');
    } else {
      localStorage.setItem(LINKEDIN_PANEL_KEY, 'enabled');
      showNotification('LinkedIn panel enabled — searching for profile...', 'success');
      tryShowLinkedInPanel();
      startLinkedInPolling();
    }
    log('LinkedIn panel:', wasEnabled ? 'DISABLED' : 'ENABLED');
  }

  function findLinkedInUrl() {
    const linkedInPattern = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w%-]+\/?/i;

    const links = document.querySelectorAll('a[href*="linkedin.com"]');
    for (const link of links) {
      if (linkedInPattern.test(link.href)) return link.href;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent;
      if (!text.includes('linkedin')) continue;
      const match = text.match(linkedInPattern);
      if (match) return match[0];
    }

    const inputs = document.querySelectorAll('input[value*="linkedin"], [data-value*="linkedin"]');
    for (const input of inputs) {
      const val = input.value || input.getAttribute('data-value') || '';
      const match = val.match(linkedInPattern);
      if (match) return match[0];
    }

    return null;
  }

  let linkedInIframeLoaded = false;

  function tryShowLinkedInPanel() {
    if (!isLinkedInPanelEnabled() || !IS_TOP_FRAME) return;

    const url = findLinkedInUrl();
    const normalizedUrl = url ? url.replace(/\/$/, '') : null;

    if (normalizedUrl !== currentLinkedInUrl) {
      currentLinkedInUrl = normalizedUrl;
      linkedInIframeLoaded = false;
      replaceCardContent(normalizedUrl, false);
    }

    ensureCardExists();

    if (normalizedUrl && !linkedInIframeLoaded && isCallConnected()) {
      linkedInIframeLoaded = true;
      loadLinkedInIframe(normalizedUrl);
    }
  }

  function ensureCardExists() {
    if (document.getElementById('ct-linkedin-card')) return;
    linkedInIframeLoaded = false;
    replaceCardContent(currentLinkedInUrl, false);
  }

  function getActivityContainer() {
    return document.querySelector('app-session-activity');
  }

  const LI_SVG_16 = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  const LI_SVG_32 = LI_SVG_16.replace('width="16" height="16"', 'width="32" height="32"');

  function replaceCardContent(url, withIframe) {
    const oldCard = document.getElementById('ct-linkedin-card');
    if (oldCard) oldCard.remove();

    const container = getActivityContainer();
    if (!container) return;

    container.setAttribute('data-ct-linkedin-active', '');

    const card = document.createElement('div');
    card.id = 'ct-linkedin-card';

    if (url) {
      const slug = url.split('/in/')[1]?.replace(/\/$/, '') || '';
      card.innerHTML = `
        <div class="ct-li-header">
          ${LI_SVG_16}
          <span>LinkedIn</span>
          <span class="ct-li-url">${slug}</span>
        </div>
        <div class="ct-li-waiting" id="ct-li-waiting">
          ${LI_SVG_32}
          <div>Waiting for call to connect\u2026<br>
          <span style="font-size:11px;opacity:0.7">LinkedIn profile will load once the prospect picks up.</span></div>
        </div>
      `;

      if (withIframe) {
        loadLinkedInIframe(url);
      }
    } else {
      card.innerHTML = `
        <div class="ct-li-header">
          ${LI_SVG_16}
          <span>LinkedIn</span>
        </div>
        <div class="ct-li-empty">
          ${LI_SVG_32}
          <div>No LinkedIn URL found for this prospect.<br>
          The URL will appear automatically when detected.</div>
        </div>
      `;
    }

    container.appendChild(card);
    optimizeLayoutForLinkedIn(true);
  }

  function loadLinkedInIframe(url) {
    const card = document.getElementById('ct-linkedin-card');
    if (!card) return;

    const waiting = card.querySelector('#ct-li-waiting');
    if (waiting) {
      waiting.innerHTML = '<div class="ct-li-spinner"></div>';
      waiting.className = 'ct-li-loading';
    }

    const iframe = document.createElement('iframe');
    iframe.className = 'ct-li-iframe';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    iframe.loading = 'lazy';
    iframe.src = url;
    iframe.onload = () => {
      const loader = card.querySelector('.ct-li-loading');
      if (loader) loader.remove();
    };
    setTimeout(() => {
      const loader = card.querySelector('.ct-li-loading');
      if (loader) loader.remove();
    }, 10000);

    card.appendChild(iframe);
    log('LinkedIn iframe loaded (call connected):', url);
  }

  function removeLinkedInPanel() {
    const card = document.getElementById('ct-linkedin-card');
    if (card) card.remove();
    const container = getActivityContainer();
    if (container) container.removeAttribute('data-ct-linkedin-active');
    currentLinkedInUrl = null;
    linkedInIframeLoaded = false;
    optimizeLayoutForLinkedIn(false);
  }

  function optimizeLayoutForLinkedIn(enable) {
    const activity = document.querySelector('app-session-activity');
    if (!activity) return;
    const parent = activity.parentElement;
    if (!parent) return;
    const children = Array.from(parent.children);
    const actIdx = children.indexOf(activity);
    for (let i = 0; i < actIdx; i++) {
      if (enable) {
        children[i].setAttribute('data-ct-compact', String(i));
      } else {
        children[i].removeAttribute('data-ct-compact');
      }
    }
  }

  // ================================================================
  // ONE-PAGER PROSPECT PANEL (A/B test — shows LeadFlow one-pager)
  // ================================================================

  function isOnePagerPanelEnabled() {
    return localStorage.getItem(ONEPAGER_PANEL_KEY) === 'enabled';
  }

  function detectClientName() {
    if (!onePagerMap) return null;
    const clientKeys = Object.keys(onePagerMap);
    if (clientKeys.length === 0) return null;

    const pageText = document.body.innerText || '';
    const pageTextLower = pageText.toLowerCase();

    // Sort by length descending so "blendhub - dairy" matches before "blendhub"
    const sorted = clientKeys.slice().sort((a, b) => b.length - a.length);
    for (const key of sorted) {
      if (pageTextLower.includes(key)) {
        return key;
      }
    }
    return null;
  }

  function tryShowOnePagerPanel() {
    if (!isOnePagerPanelEnabled() || !IS_TOP_FRAME || !onePagerMap) return;

    const clientKey = detectClientName();
    const sheetId = clientKey ? onePagerMap[clientKey] : null;

    if (sheetId === currentOnePagerId) {
      ensureOnePagerCardExists();
      return;
    }

    currentOnePagerId = sheetId;
    replaceOnePagerCardContent(sheetId, clientKey);
  }

  function ensureOnePagerCardExists() {
    if (document.getElementById('ct-onepager-card')) return;
    replaceOnePagerCardContent(currentOnePagerId, null);
  }

  const OP_SVG_16 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  const OP_SVG_32 = OP_SVG_16.replace('width="16" height="16"', 'width="32" height="32"');

  function replaceOnePagerCardContent(sheetId, clientKey) {
    const oldCard = document.getElementById('ct-onepager-card');
    if (oldCard) oldCard.remove();

    const container = getActivityContainer();
    if (!container) return;

    container.setAttribute('data-ct-linkedin-active', '');

    const card = document.createElement('div');
    card.id = 'ct-onepager-card';
    card.style.cssText = 'display:flex!important;flex-direction:column;height:100%;overflow:hidden;';

    if (sheetId) {
      const displayName = clientKey ? clientKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'One-Pager';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#7c3aed;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;font-size:12px;font-weight:600;flex-shrink:0;letter-spacing:0.3px;">
          ${OP_SVG_16}
          <span>One-Pager</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.85;font-weight:400;font-size:11px;">${displayName}</span>
        </div>
        <div class="ct-li-loading">
          <div class="ct-li-spinner" style="border-top-color:#7c3aed!important;"></div>
        </div>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'flex:1;width:100%;border:none;background:#f8fafc;';
      iframe.loading = 'lazy';
      iframe.src = ONEPAGER_BASE_URL + sheetId;
      iframe.onload = () => {
        const loader = card.querySelector('.ct-li-loading');
        if (loader) loader.remove();
      };
      setTimeout(() => {
        const loader = card.querySelector('.ct-li-loading');
        if (loader) loader.remove();
      }, 10000);

      card.appendChild(iframe);
    } else {
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#7c3aed;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;font-size:12px;font-weight:600;flex-shrink:0;letter-spacing:0.3px;">
          ${OP_SVG_16}
          <span>One-Pager</span>
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:32px;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;font-size:13px;text-align:center;">
          ${OP_SVG_32}
          <div>No one-pager found for this campaign.<br>
          The one-pager will appear automatically when a matching client is detected.</div>
        </div>
      `;
    }

    container.appendChild(card);
    optimizeLayoutForLinkedIn(true);
  }

  function removeOnePagerPanel() {
    const card = document.getElementById('ct-onepager-card');
    if (card) card.remove();
    const container = getActivityContainer();
    if (container) container.removeAttribute('data-ct-linkedin-active');
    currentOnePagerId = null;
    optimizeLayoutForLinkedIn(false);
  }

  function startOnePagerPolling() {
    if (window._ctOnePagerPollActive) return;
    window._ctOnePagerPollActive = true;
    setInterval(tryShowOnePagerPanel, LINKEDIN_POLL_MS);
  }

  // ================================================================
  // A/B CONFIG (remote whitelist for LinkedIn + One-Pager)
  // ================================================================

  async function fetchRemoteConfig() {
    if (!IS_TOP_FRAME) return;
    try {
      const resp = await fetch(CONFIG_URL + '?_=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) return;
      const config = await resp.json();
      linkedInWhitelist = (config.linkedinUsers || []).map(u => u.toLowerCase().trim());
      onePagerWhitelist = (config.onePagerUsers || []).map(u => u.toLowerCase().trim());
      onePagerMap = config.onePagerMap || {};
      log('Config loaded: LinkedIn whitelist:', linkedInWhitelist.length, '| One-pager whitelist:', onePagerWhitelist.length, '| Client map:', Object.keys(onePagerMap).length);
      applyPanelAccess();
    } catch (e) {
      log('Config fetch failed:', e.message);
    }
  }

  function getStoredAgentEmail() {
    return localStorage.getItem(LINKEDIN_USER_KEY);
  }

  function detectAgentEmail() {
    const stored = getStoredAgentEmail();
    if (stored) return stored;

    // Search ALL localStorage and sessionStorage for @throxy.com emails
    const storages = [localStorage, sessionStorage];
    for (const storage of storages) {
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          const val = storage.getItem(key);
          if (!val || val.length > 200000) continue;

          // Check JWTs
          if (val.includes('.') && val.split('.').length === 3) {
            try {
              const payload = JSON.parse(atob(val.split('.')[1]));
              const email = payload.email || payload.sub || payload.user_email;
              if (email && email.includes('@')) return email.toLowerCase();
            } catch (_) {}
          }

          // Check JSON objects (deep: up to 2 levels)
          if (val.startsWith('{') || val.startsWith('[')) {
            try {
              const obj = JSON.parse(val);
              const found = findEmailInObj(obj, 2);
              if (found) return found;
            } catch (_) {}
          }

          // Check raw string for @throxy.com
          if (val.includes('@throxy.com')) {
            const m = val.match(/[\w.+-]+@throxy\.com/i);
            if (m) return m[0].toLowerCase();
          }
        }
      } catch (_) {}
    }
    return null;
  }

  function findEmailInObj(obj, depth) {
    if (depth <= 0 || !obj || typeof obj !== 'object') return null;
    const vals = Array.isArray(obj) ? obj : Object.values(obj);
    for (const v of vals) {
      if (typeof v === 'string' && v.includes('@')) {
        const m = v.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
        if (m) return m[0].toLowerCase();
      }
      if (typeof v === 'object' && v) {
        const found = findEmailInObj(v, depth - 1);
        if (found) return found;
      }
    }
    return null;
  }

  function isEmailInList(list) {
    if (!list) return null;
    if (list.length === 0) return false;
    const email = detectAgentEmail();
    if (!email) return null;
    return list.some(u => email === u || email.includes(u) || u.includes(email));
  }

  function isUserWhitelisted() {
    return isEmailInList(linkedInWhitelist);
  }

  let emailPromptShown = false;

  function applyPanelAccess() {
    let email = detectAgentEmail();

    // If email not found, prompt once per session
    if (!email && !emailPromptShown && IS_TOP_FRAME) {
      emailPromptShown = true;
      const input = prompt('[CloudTalk Shortcuts] Enter your Throxy email to enable the side panel:');
      if (input && input.includes('@')) {
        email = input.toLowerCase().trim();
        localStorage.setItem(LINKEDIN_USER_KEY, email);
        log('Email stored:', email);
      }
    }

    if (!email) {
      log('Email not detected — panels cannot be assigned');
      return;
    }

    const inOnePager = onePagerWhitelist && onePagerWhitelist.some(u => email === u || email.includes(u) || u.includes(email));
    const inLinkedIn = linkedInWhitelist && linkedInWhitelist.some(u => email === u || email.includes(u) || u.includes(email));

    // One-pager group: enable one-pager, disable LinkedIn
    if (inOnePager) {
      if (isLinkedInPanelEnabled()) {
        localStorage.removeItem(LINKEDIN_PANEL_KEY);
        removeLinkedInPanel();
      }
      if (!isOnePagerPanelEnabled()) {
        localStorage.setItem(ONEPAGER_PANEL_KEY, 'enabled');
        showNotification('One-pager preview enabled for your account', 'success');
      }
      tryShowOnePagerPanel();
      startOnePagerPolling();
      return;
    }

    // LinkedIn group: enable LinkedIn, disable one-pager
    if (inLinkedIn) {
      if (isOnePagerPanelEnabled()) {
        localStorage.removeItem(ONEPAGER_PANEL_KEY);
        removeOnePagerPanel();
      }
      if (!isLinkedInPanelEnabled()) {
        localStorage.setItem(LINKEDIN_PANEL_KEY, 'enabled');
        showNotification('LinkedIn preview enabled for your account', 'success');
      }
      tryShowLinkedInPanel();
      startLinkedInPolling();
      return;
    }

    // Not in either list: disable both
    if (isLinkedInPanelEnabled()) {
      localStorage.removeItem(LINKEDIN_PANEL_KEY);
      removeLinkedInPanel();
    }
    if (isOnePagerPanelEnabled()) {
      localStorage.removeItem(ONEPAGER_PANEL_KEY);
      removeOnePagerPanel();
    }
  }

  function startLinkedInPolling() {
    if (window._ctLinkedInPollActive) return;
    window._ctLinkedInPollActive = true;
    setInterval(tryShowLinkedInPanel, LINKEDIN_POLL_MS);
  }

  function expandDispositionsOnce() {
    const showMoreBtn = document.querySelector('.session-dispositions__show-more button');
    if (showMoreBtn && showMoreBtn.textContent.includes('Show More')) {
      log('Expanding dispositions...');
      showMoreBtn.click();
      return true;
    }
    return false;
  }

  function getActionableDispositions() {
    const allChips = document.querySelectorAll('cds-call-disposition .cds-chip');
    const actionable = [];
    for (const chip of allChips) {
      const isInActivity = chip.closest('.activity, [class*="activity"], .session-activity, app-activity');
      const isStatusBadge = chip.closest('.cds-badge, [class*="badge"]');
      if (!isInActivity && !isStatusBadge) actionable.push(chip);
    }
    return actionable;
  }

  function addShortcutBadges() {
    const now = Date.now();
    if (now - lastBadgeUpdate < DEBOUNCE_MS || isProcessing) return;
    isProcessing = true;
    lastBadgeUpdate = now;

    document.querySelectorAll('[data-ct-badge]').forEach(el => el.remove());

    const dispositions = getActionableDispositions();
    dispositions.forEach((chip, index) => {
      if (chip.querySelector('[data-ct-badge]')) return;
      let key;
      if (index < 9) key = String(index + 1);
      else if (index === 9) key = 'Q';
      else if (index === 10) key = 'W';
      else if (index === 11) key = 'E';
      else return;
      chip.appendChild(createBadge(key));
    });

    const hangupBtn = document.querySelector('app-button.hangup, .control-btn.hangup');
    if (hangupBtn && !hangupBtn.querySelector('[data-ct-badge]')) {
      const btn = hangupBtn.querySelector('button') || hangupBtn;
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.appendChild(createBadge('0', 'danger'));
    }

    const nextCallBtn = document.querySelector('[data-test-id="next-call-btn"]');
    if (nextCallBtn && !nextCallBtn.querySelector('[data-ct-badge]')) {
      const btn = nextCallBtn.querySelector('button') || nextCallBtn;
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.appendChild(createBadge('+', 'primary'));
    }

    isProcessing = false;
  }

  function updateUI() {
    if (isProcessing) return;
    removeActivitySection();
    expandDispositionsOnce();
    setTimeout(addShortcutBadges, 150);
    if (isOnePagerPanelEnabled()) {
      tryShowOnePagerPanel();
    } else if (isLinkedInPanelEnabled()) {
      tryShowLinkedInPanel();
    }
  }

  // ================================================================
  // CALL ACTIONS
  // ================================================================

  function hangUp() {
    const selectors = [
      'app-button.hangup button',
      'app-button.control-btn.hangup button',
      '.control-btn.hangup button',
      'app-button.hangup',
      '.hangup button',
      '.hangup',
      '[class*="hangup"] button',
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const btn = element.tagName === 'BUTTON' ? element : element.querySelector('button') || element;
        btn.click();
        showNotification('Hanging up...', 'success');
        return true;
      }
    }
    showNotification('Hang up button not found', 'error');
    return false;
  }

  function nextCall() {
    const selectors = [
      '[data-test-id="next-call-btn"] button',
      'cds-button[data-test-id="next-call-btn"] button',
      '[data-test-id="next-call-btn"]',
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const btn = element.tagName === 'BUTTON' ? element : element.querySelector('button') || element;
        btn.click();
        showNotification('Next Call', 'success');
        return true;
      }
    }
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      if (btn.textContent.includes('Next Call')) {
        btn.click();
        showNotification('Next Call', 'success');
        return true;
      }
    }
    showNotification('Next Call button not found', 'error');
    return false;
  }

  function selectDisposition(index) {
    expandDispositionsOnce();
    const dispositions = getActionableDispositions();
    if (dispositions.length === 0) {
      showNotification('No dispositions found', 'error');
      return false;
    }
    if (index < 0 || index >= dispositions.length) {
      showNotification(`Disposition ${index + 1} not available`, 'error');
      return false;
    }
    dispositions.forEach(d => d.classList.remove('ct-disposition-selected'));
    const disposition = dispositions[index];
    const badge = disposition.querySelector('[data-ct-badge]');
    const name = badge ? disposition.textContent.replace(badge.textContent, '').trim() : disposition.textContent.trim();
    disposition.click();
    disposition.classList.add('ct-disposition-selected');
    showNotification(`\u2713 ${name}`, 'success');
    return true;
  }

  function showNotification(message, type) {
    const existing = document.getElementById('ct-shortcut-notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.id = 'ct-shortcut-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed; top: 70px; right: 20px;
      padding: 12px 20px; border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px; font-weight: 500; z-index: 100000;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      ${type === 'success'
        ? 'background: #d1faec; color: #0f8960; border: 1px solid #0f8960;'
        : 'background: #fae6e6; color: #aa322e; border: 1px solid #aa322e;'}
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // ================================================================
  // STATUS BANNER UI
  // ================================================================

  function renderStatusBanner(status) {
    let banner = document.getElementById('ct-time-status');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ct-time-status';
      document.body.appendChild(banner);
    }

    const shiftIcon = selectedBatch === 'Morning' ? '\u2600' : '\u263E';
    const shiftTag = selectedBatch
      ? `<span class="ct-shift-tag">${shiftIcon} ${selectedBatch}</span>`
      : '';

    if (status.noBatchSelected) {
      banner.className = 'ct-status-nobatch';
      banner.innerHTML = `<span class="ct-dot"></span> SELECT YOUR SHIFT TO START \u2014 ${status.currentTime}`;
    } else if (status.isBreak) {
      banner.className = 'ct-status-break';
      let text = `<span class="ct-dot"></span> ${shiftTag} BREAK \u2014 ${status.currentTime}`;
      if (status.nextBlock && status.minutesToNextBlock !== null) {
        text += ` \u00B7 Next block: ${status.nextBlock.start} (${status.minutesToNextBlock} min)`;
      } else {
        text += ` \u00B7 ${status.message}`;
      }
      banner.innerHTML = text;
    } else if (status.isFreeCalling) {
      banner.className = 'ct-status-free';
      banner.innerHTML = `<span class="ct-dot"></span> ${shiftTag} FREE CALLING \u2014 All blocks done \u00B7 ${status.currentTime}`;
    } else {
      banner.className = 'ct-status-active';
      const block = status.currentBlock;
      const lastTag = status.isLastBlock ? ' \u00B7 Free calling after this block' : '';
      banner.innerHTML = `<span class="ct-dot"></span> ${shiftTag} ACTIVE \u2014 ${block.start}\u2013${block.end} \u00B7 ${status.minutesRemaining} min remaining \u00B7 ${status.currentTime}${lastTag}`;
    }
  }

  // ================================================================
  // SHIFT SELECTOR OVERLAY (shown when no shift selected today)
  // ================================================================

  function showBatchSelectorOverlay() {
    if (document.getElementById('ct-batch-selector')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ct-batch-selector';
    overlay.innerHTML = `
      <div class="ct-batch-card">
        <div class="ct-batch-logo">\uD83D\uDCDE</div>
        <div class="ct-batch-title">Which shift are you on today?</div>
        <div class="ct-batch-subtitle">
          This sets your calling schedule for the day.<br>
          You won\u2019t be able to change it once selected.
        </div>
        <div class="ct-batch-buttons">
          <button class="ct-batch-pick" data-ct-pick="Morning">
            <span class="ct-pick-icon">\u2600\uFE0F</span>
            Morning
          </button>
          <button class="ct-batch-pick" data-ct-pick="Afternoon">
            <span class="ct-pick-icon">\uD83C\uDF19</span>
            Afternoon
          </button>
        </div>
        <div class="ct-batch-lock-note">\uD83D\uDD12 This choice is locked for the rest of the day</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-ct-pick]').forEach(btn => {
      btn.onclick = () => selectBatch(btn.getAttribute('data-ct-pick'));
    });
  }

  function hideBatchSelectorOverlay() {
    const overlay = document.getElementById('ct-batch-selector');
    if (overlay) overlay.remove();
  }

  // ================================================================
  // BREAK / SHIFT-END WARNING BANNER (non-blocking)
  // ================================================================

  function getBreakKey(status) {
    if (status.nextBlock) return 'before-' + status.nextBlock.start;
    return status.message || 'break';
  }

  function showBreakWarning(status) {
    const key = getBreakKey(status);
    if (key !== lastBreakKey) {
      breakWarningDismissed = false;
      lastBreakKey = key;
    }
    if (breakWarningDismissed) return;

    let warning = document.getElementById('ct-break-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'ct-break-warning';
      document.body.appendChild(warning);
    }

    let nextInfo = '';
    if (status.nextBlock && status.minutesToNextBlock !== null) {
      nextInfo = `Next block at ${status.nextBlock.start} (${status.minutesToNextBlock} min)`;
    } else if (status.message) {
      nextInfo = status.message;
    }

    warning.innerHTML = `
      <button class="ct-dismiss-btn" id="ct-break-dismiss">\u2715</button>
      <div class="ct-warn-title">\u26A0\uFE0F Please Exit the Campaign</div>
      <div class="ct-warn-subtitle">
        Leave and rejoin to refresh your calling list.${nextInfo ? ' \u00B7 ' + nextInfo : ''}
      </div>
    `;

    const dismissBtn = document.getElementById('ct-break-dismiss');
    if (dismissBtn) {
      dismissBtn.onclick = (e) => {
        e.stopPropagation();
        breakWarningDismissed = true;
        hideBreakWarning();
      };
    }
  }

  function hideBreakWarning() {
    const warning = document.getElementById('ct-break-warning');
    if (warning) warning.remove();
  }

  // ================================================================
  // MICROPHONE WARNING UI
  // ================================================================

  function showMicWarning(message) {
    if (micWarningDismissed) return;

    let banner = document.getElementById('ct-mic-warning');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'ct-mic-warning';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<span class="ct-mic-icon">\uD83C\uDFA7</span> HEADSET REQUIRED \u2014 ${message}<button class="ct-dismiss-btn" id="ct-mic-dismiss">\u2715</button>`;

    const dismissBtn = document.getElementById('ct-mic-dismiss');
    if (dismissBtn) {
      dismissBtn.onclick = (e) => {
        e.stopPropagation();
        micWarningDismissed = true;
        hideMicWarning();
      };
    }
  }

  function hideMicWarning() {
    const banner = document.getElementById('ct-mic-warning');
    if (banner) banner.remove();
  }

  // ================================================================
  // MAIN SCHEDULE AWARENESS LOOP
  // ================================================================

  function enforceTimeBlocks() {
    const status = getCurrentBlockStatus();

    if (!IS_TOP_FRAME) return;

    renderStatusBanner(status);

    if (!selectedBatch) {
      showBatchSelectorOverlay();
      return;
    } else {
      hideBatchSelectorOverlay();
    }

    if (status.isBreak && !status.noBatchSelected) {
      showBreakWarning(status);
    } else {
      hideBreakWarning();
    }
  }

  // ================================================================
  // AUTO-UPDATE CHECK
  // ================================================================

  function compareVersions(remote, local) {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return 1;
      if (rv < lv) return -1;
    }
    return 0;
  }

  async function checkForUpdate() {
    if (!IS_TOP_FRAME) return;
    try {
      const cacheBuster = Math.floor(Date.now() / 60000);
      const resp = await fetch(UPDATE_XML_URL + '?_=' + cacheBuster, { cache: 'no-store' });
      if (!resp.ok) return;
      const xml = await resp.text();
      const match = xml.match(/version='([^']+)'/);
      if (!match) return;
      const remoteVersion = match[1];
      log('Version check: local=' + CURRENT_VERSION + ' remote=' + remoteVersion);
      if (compareVersions(remoteVersion, CURRENT_VERSION) > 0) {
        showUpdateBanner(remoteVersion);
      }
    } catch (e) {
      log('Update check failed:', e.message);
    }
  }

  function showUpdateBanner(newVersion) {
    if (document.getElementById('ct-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'ct-update-banner';
    banner.innerHTML = `
      <span class="ct-update-text">\u2B06\uFE0F Update available</span>
      <span class="ct-update-version">v${CURRENT_VERSION} \u2192 v${newVersion}</span>
      <span class="ct-update-text">Please restart Chrome to apply.</span>
      <button class="ct-update-action" id="ct-update-reload-btn">Reload Page</button>
    `;
    document.body.appendChild(banner);

    const reloadBtn = document.getElementById('ct-update-reload-btn');
    if (reloadBtn) {
      reloadBtn.onclick = () => window.location.reload();
    }
  }

  // ================================================================
  // OUTBOUND NUMBER ENFORCEMENT — lock to "Automatic"
  // ================================================================

  function enforceAutomaticOutbound() {
    if (!IS_TOP_FRAME || !isSessionPage()) return;

    const label = document.querySelector('[data-test-id="OutboundMainLabel"]');
    if (!label) return;

    const current = label.textContent.trim();
    if (current !== 'Automatic') {
      log('Outbound not Automatic (' + current + ') — clicking to open selector');
      const btn = document.querySelector('[data-test-id="OutboundSelectButton"]');
      if (btn) {
        btn.click();
        setTimeout(() => {
          const options = document.querySelectorAll('[data-test-id="OutboundMainLabel"]');
          for (const opt of document.querySelectorAll('app-outbound-select button, [class*="outbound"] button, [class*="select-option"]')) {
            if (opt.textContent.includes('Automatic')) {
              opt.click();
              log('Outbound forced to Automatic');
              return;
            }
          }
          // If we can't find the Automatic option in dropdown, try pressing Escape
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }, 500);
      }
    }

    // Lock the selector: prevent pointer events on the outbound select
    const selectEl = document.querySelector('app-outbound-select');
    if (selectEl && !selectEl.hasAttribute('data-ct-locked')) {
      selectEl.setAttribute('data-ct-locked', 'true');
      selectEl.style.pointerEvents = 'none';
      selectEl.style.opacity = '0.7';
      selectEl.title = 'Outbound number is locked to Automatic by company policy';
    }
  }

  // ================================================================
  // INPUT DETECTION
  // ================================================================

  function isTypingInInput(event) {
    const target = event.target;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return true;
    if (target.isContentEditable) return true;
    if (target.getAttribute('role') === 'textbox') return true;
    return false;
  }

  // ================================================================
  // KEYBOARD HANDLER
  // ================================================================

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      toggleLinkedInPanel();
      return;
    }

    if (isTypingInInput(event)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const key = event.key;

    if (key === '+' || key === '=') {
      event.preventDefault();
      nextCall();
      return;
    }

    if (key === '0') { event.preventDefault(); hangUp(); return; }

    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      selectDisposition(parseInt(key, 10) - 1);
      return;
    }

    if (key.toLowerCase() === 'q') { event.preventDefault(); selectDisposition(9); return; }
    if (key.toLowerCase() === 'w') { event.preventDefault(); selectDisposition(10); return; }
    if (key.toLowerCase() === 'e') { event.preventDefault(); selectDisposition(11); return; }
  }

  // ================================================================
  // INITIALIZATION
  // ================================================================

  addStyles();

  // Load saved shift selection for today
  selectedBatch = loadBatchSelection();
  if (selectedBatch) {
    log('Loaded shift selection for today:', selectedBatch);
  } else {
    log('No shift selected for today \u2014 will prompt user');
  }

  if (IS_TOP_FRAME) {
    setTimeout(updateUI, 500);
    setTimeout(updateUI, 1500);
    setTimeout(updateUI, 3000);

    enforceTimeBlocks();
    setInterval(enforceTimeBlocks, CHECK_INTERVAL_MS);

    // Update status banner time every second for a live clock feel
    setInterval(() => {
      const banner = document.getElementById('ct-time-status');
      if (banner) {
        enforceTimeBlocks();
      }
    }, 1000);

    setTimeout(checkForUpdate, 5000);
    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    setTimeout(fetchRemoteConfig, 3000);
    setInterval(fetchRemoteConfig, CONFIG_FETCH_INTERVAL_MS);

    // Enforce Automatic outbound number selection
    setTimeout(enforceAutomaticOutbound, 2000);
    setInterval(enforceAutomaticOutbound, CHECK_INTERVAL_MS);

    if (isOnePagerPanelEnabled()) {
      setTimeout(tryShowOnePagerPanel, 2000);
      startOnePagerPolling();
    } else if (isLinkedInPanelEnabled()) {
      setTimeout(tryShowLinkedInPanel, 2000);
      startLinkedInPolling();
    }

    checkMicrophone();
    setInterval(checkMicrophone, MIC_CHECK_INTERVAL_MS);
    if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = () => {
        log('Audio device change detected');
        micWarningDismissed = false;
        checkMicrophone();
      };
    }
    try {
      navigator.permissions.query({ name: 'microphone' }).then(permStatus => {
        permStatus.onchange = () => {
          log('Microphone permission changed to:', permStatus.state);
          checkMicrophone();
        };
      });
    } catch (_) {}
  }

  let observerTimeout = null;
  function isPanelMutation(m) {
    const t = m.target;
    if (t.id === 'ct-linkedin-card' || t.id === 'ct-onepager-card') return true;
    if (t.closest?.('#ct-linkedin-card') || t.closest?.('#ct-onepager-card')) return true;
    if (t.tagName === 'APP-SESSION-ACTIVITY' || t.closest?.('app-session-activity')) {
      const isOurNode = n => n?.id === 'ct-linkedin-card' || n?.id === 'ct-onepager-card' || n?.nodeType === 1 && n?.hasAttribute?.('data-ct-linkedin-active');
      for (const n of (m.addedNodes || [])) { if (isOurNode(n)) return true; }
      for (const n of (m.removedNodes || [])) { if (isOurNode(n)) return true; }
    }
    return false;
  }
  const observer = new MutationObserver((mutations) => {
    const dominated = mutations.every(m => {
      const t = m.target;
      if (t.hasAttribute?.('data-ct-badge')) return true;
      if (m.addedNodes?.[0]?.hasAttribute?.('data-ct-badge')) return true;
      if (isPanelMutation(m)) return true;
      return false;
    });
    if (dominated) return;
    if (observerTimeout) clearTimeout(observerTimeout);
    observerTimeout = setTimeout(updateUI, 300);
  });

  const targetNode = document.querySelector('app-session, app-dialer, main') || document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });

  document.addEventListener('keydown', handleKeyDown, true);
  const panelStatus = isOnePagerPanelEnabled() ? 'One-Pager ON' : isLinkedInPanelEnabled() ? 'LinkedIn ON' : 'panels OFF';
  log('Extension ready (schedules + mic warning + ' + panelStatus + ')');

})();
