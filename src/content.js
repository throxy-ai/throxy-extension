/**
 * Throxy Extension — Disposition Shortcuts + Schedule Awareness + Headset Mic Warning
 * + TalkTrack Panel
 *
 * SHORTCUTS:
 *   0:            Hang up the call
 *   1-9:          Select disposition 1-9
 *   Q:            Select disposition 10
 *   W:            Select disposition 11
 *   E:            Select disposition 12
 *   +:            Next Call (Plus key)
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
 * TALKTRACK PANEL:
 *   Displays a rendered talk track in the activity column based on the
 *   current campaign/list name. Talk tracks are markdown files hosted on
 *   throxy-extension.throxy.ai/talk-tracks/. Client-to-file mapping is
 *   managed in config.json (talkTrackMap). Layout auto-compresses left
 *   panels to give the talk track more space.
 */

(() => {
  'use strict';

  // One-time localStorage clear (v1.9.12) — requested for Capetown OU
  if (!localStorage.getItem('ct-storage-cleared-v1.10.0')) {
    localStorage.clear();
    localStorage.setItem('ct-storage-cleared-v1.10.0', 'true');
    console.log('[Throxy] localStorage cleared for v1.9.12');
  }

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

  const CURRENT_VERSION = chrome.runtime.getManifest().version;
  const UPDATE_XML_URL = 'https://throxy-extension.throxy.ai/updates.xml';
  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const CHECK_INTERVAL_MS = 5000;
  const MIC_CHECK_INTERVAL_MS = 15000;
  const TALKTRACK_POLL_MS = 3000;
  const CONFIG_URL = 'https://throxy-extension.throxy.ai/config.json';
  const CONFIG_FETCH_INTERVAL_MS = 2 * 60 * 1000;
  const IS_TOP_FRAME = window.self === window.top;
  const BATCH_STORAGE_KEY = 'ct-batch-selection';
  const TALKTRACK_BASE_URL = 'https://throxy-extension.throxy.ai/talk-tracks/';
  const CAMPAIGN_CACHE_KEY = 'ct-campaign-contacts-cache';
  const CAMPAIGN_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  const CAMPAIGNS_API_BASE = 'https://campaigns.cloudtalk.io/api/v1/campaigns';
  const THROXY_API_BASE = 'https://api.throxy.ai/v1';
  const THROXY_MACHINE_TOKEN =
    'thx_8df17899609d2670ee83362102902b6653b8d4053d205d131903b0d9bba82f33';

  // ================================================================
  // STATE
  // ================================================================
  let lastBadgeUpdate = 0;
  let isProcessing = false;
  const DEBOUNCE_MS = 500;
  let isMicBlocked = false;
  let selectedBatch = null; // 'Morning' or 'Afternoon', null = not chosen today
  let breakWarningDismissed = false; // reset when break period changes
  let lastBreakKey = null; // tracks which break period was dismissed
  let micWarningDismissed = false; // user closed the mic warning
  let talkTrackMap = null; // null = config not fetched; { clientName: mdFilename }
  let talkTrackMeta = {}; // { filename: { website, booking_link } }
  let currentTalkTrackKey = null; // tracks current talk track client key
  let talkTrackCache = {}; // { filename: renderedHTML }

  function log(...args) {
    console.log('[Throxy Extension]', ...args);
  }

  if (IS_TOP_FRAME) {
    console.log('===========================================');
    console.log('[Throxy Extension] EXTENSION LOADED!');
    console.log('[Throxy Extension] Shortcuts:');
    console.log('  0            = Hang up');
    console.log('  1-9          = Disposition 1-9');
    console.log('  Q/W/E        = Disposition 10/11/12');
    console.log('  +            = Next Call');
    console.log('[Throxy Extension] Schedule warnings: ACTIVE');
    console.log('[Throxy Extension] Headset mic warning: ACTIVE');
    console.log('[Throxy Extension] TalkTrack panel: ACTIVE');
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
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
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
      if (
        data.date === todayDateStr() &&
        (data.batch === 'Morning' || data.batch === 'Afternoon')
      ) {
        return data.batch;
      }
      return null; // expired (different day)
    } catch (_) {
      return null;
    }
  }

  function saveBatchSelection(batch) {
    localStorage.setItem(
      BATCH_STORAGE_KEY,
      JSON.stringify({
        date: todayDateStr(),
        batch: batch,
      })
    );
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

  function isCampaignListPage() {
    return window.location.pathname === '/p/dialer/campaigns';
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
    return (
      date.getHours().toString().padStart(2, '0') +
      ':' +
      date.getMinutes().toString().padStart(2, '0')
    );
  }

  function formatTimeWithSeconds(date) {
    return (
      formatTime(date) + ':' + date.getSeconds().toString().padStart(2, '0')
    );
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
        const isLast = i === blocks.length - 1;
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
      minutesToNextBlock: nextBlock
        ? timeToMinutes(nextBlock.start) - currentMinutes
        : null,
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
    const timer = document.querySelector(
      '.call-timer, [class*="call-timer"], [class*="call-duration"]'
    );
    if (
      timer &&
      timer.offsetParent !== null &&
      timer.textContent.trim().length > 0
    )
      return true;
    return false;
  }

  function isCallConnected() {
    const timer = document.querySelector(
      '.call-timer, [class*="call-timer"], [class*="call-duration"]'
    );
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
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');

      if (audioInputs.length === 0) {
        isMicBlocked = true;
        if (IS_TOP_FRAME)
          showMicWarning(
            'No microphone detected. Please connect your headset.'
          );
        return;
      }

      const hasLabels = audioInputs.some((d) => d.label.length > 0);
      if (!hasLabels) {
        let permDenied = false;
        try {
          const permStatus = await navigator.permissions.query({
            name: 'microphone',
          });
          permDenied = permStatus.state === 'denied';
        } catch (_) {}

        if (permDenied) {
          isMicBlocked = true;
          if (IS_TOP_FRAME)
            showMicWarning(
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

      const defaultDevice = audioInputs.find((d) => d.deviceId === 'default');
      const commsDevice = audioInputs.find(
        (d) => d.deviceId === 'communications'
      );

      const isRealtekDefault =
        defaultDevice && defaultDevice.label.toLowerCase().includes('realtek');
      const isRealtekComms =
        commsDevice && commsDevice.label.toLowerCase().includes('realtek');

      const hasHeadset = audioInputs.some((d) => {
        if (d.deviceId === 'default' || d.deviceId === 'communications')
          return false;
        if (d.label === '') return false;
        const lbl = d.label.toLowerCase();
        return (
          !lbl.includes('realtek') &&
          !lbl.includes('built-in') &&
          !lbl.includes('internal')
        );
      });

      if (isRealtekDefault || isRealtekComms) {
        isMicBlocked = true;
        if (hasHeadset) {
          if (IS_TOP_FRAME)
            showMicWarning(
              'Your default microphone is Realtek (laptop mic). Switch to your headset in system sound settings.'
            );
        } else {
          if (IS_TOP_FRAME)
            showMicWarning(
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

      /* Hide activity content when TalkTrack panel replaces it */
      app-session-activity[data-ct-talktrack-active] > *:not(#ct-talktrack-card) {
        display: none !important;
      }

      /* === Compact layout: shrink left panels when TalkTrack is active === */
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
      app-session-activity[data-ct-talktrack-active] {
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }

      /* === TalkTrack Panel (inside activity column) === */
      #ct-talktrack-card {
        display: flex !important; flex-direction: column;
        height: 100%; overflow: hidden;
      }
      #ct-talktrack-card .ct-tt-header {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; background: #0f172a; color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 12px; font-weight: 600; flex-shrink: 0;
        letter-spacing: 0.3px;
      }
      #ct-talktrack-card .ct-tt-header svg { flex-shrink: 0; }
      #ct-talktrack-card .ct-tt-client {
        flex: 1; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; opacity: 0.85; font-weight: 400;
        font-size: 11px;
      }
      #ct-talktrack-card .ct-tt-link {
        display: inline-flex; align-items: center; gap: 4px;
        color: rgba(255,255,255,0.85); text-decoration: none;
        font-size: 11px; font-weight: 400;
        padding: 2px 6px; border-radius: 3px;
        background: rgba(255,255,255,0.1);
        transition: background 0.15s;
      }
      #ct-talktrack-card .ct-tt-link:hover {
        background: rgba(255,255,255,0.2); color: #fff;
      }
      #ct-talktrack-card .ct-tt-link svg { flex-shrink: 0; }
      #ct-talktrack-card .ct-tt-body {
        flex: 1; overflow-y: auto; padding: 16px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 13px; line-height: 1.6; color: #1e293b;
        background: #ffffff;
      }
      #ct-talktrack-card .ct-tt-body h1 {
        font-size: 16px; font-weight: 700; margin: 0 0 4px; color: #0f172a;
      }
      #ct-talktrack-card .ct-tt-body h2 {
        font-size: 14px; font-weight: 700; margin: 20px 0 8px; color: #0f172a;
        border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;
      }
      #ct-talktrack-card .ct-tt-body h3 {
        font-size: 13px; font-weight: 600; margin: 14px 0 6px; color: #334155;
      }
      #ct-talktrack-card .ct-tt-body p { margin: 6px 0; }
      #ct-talktrack-card .ct-tt-body ul {
        margin: 6px 0; padding-left: 18px;
      }
      #ct-talktrack-card .ct-tt-body li { margin: 3px 0; }
      #ct-talktrack-card .ct-tt-body hr {
        border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;
      }
      #ct-talktrack-card .ct-tt-body blockquote {
        margin: 8px 0; padding: 8px 12px;
        border-left: 3px solid #cbd5e1; color: #475569;
        background: #f8fafc; font-size: 12px;
      }
      #ct-talktrack-card .ct-tt-body strong { font-weight: 600; }
      #ct-talktrack-card .ct-tt-body em { font-style: italic; }
      #ct-talktrack-card .ct-tt-empty {
        flex: 1; display: flex; align-items: center; justify-content: center;
        flex-direction: column; gap: 12px; padding: 32px;
        color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 13px; text-align: center;
      }
      #ct-talktrack-card .ct-tt-loading {
        flex: 1; display: flex; align-items: center; justify-content: center;
      }
      #ct-talktrack-card .ct-tt-spinner {
        width: 24px; height: 24px; border: 3px solid #e2e8f0;
        border-top-color: #0f172a; border-radius: 50%;
        animation: ct-tt-spin 0.8s linear infinite;
      }
      @keyframes ct-tt-spin { to { transform: rotate(360deg); } }

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

      /* === Campaign List: hide stats subtitle, enlarge campaign name === */
      .cds-list-item__detail { display: none !important; }
      .cds-list-item__label {
        font-size: 15px !important;
        font-weight: 600 !important;
        line-height: 1.4 !important;
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

      /* === Block all campaign clicks while checks are running === */
      .ct-campaigns-checking cds-list-item,
      .ct-campaigns-checking .cds-list-item {
        pointer-events: none !important;
        opacity: 0.6 !important;
      }
      /* === Empty campaign row === */
      .ct-campaign-empty {
        opacity: 0.4 !important;
        pointer-events: none !important;
      }
      /* === Campaign with data row === */
      .ct-campaign-has-data {
        pointer-events: auto !important;
        opacity: 1 !important;
        background: rgba(34, 197, 94, 0.08) !important;
      }

      /* === Campaign list layout === */
      .cdk-virtual-scroll-content-wrapper {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        align-items: center !important;
      }

      /* === Request New Lists Button === */
      #ct-request-lists-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        margin-left: auto;
        padding: 6px 16px;
        background: transparent; color: #334fff;
        border: 1.5px dashed #334fff; border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 12px; font-weight: 600;
        cursor: pointer; transition: all 0.2s ease;
        letter-spacing: 0.3px; white-space: nowrap;
      }
      #ct-request-lists-btn:hover:not(:disabled) {
        background: rgba(51, 79, 255, 0.08);
        border-color: #1a3be6;
        transform: translateY(-1px);
      }
      #ct-request-lists-btn:active:not(:disabled) { transform: translateY(0); }
      #ct-request-lists-btn.ct-btn-unavailable {
        color: #9ca3af; border-color: #d1d5db;
        cursor: default;
      }
      #ct-request-lists-btn.ct-btn-checking {
        color: #6b7280; border-color: #d1d5db;
        cursor: wait;
      }
      #ct-request-lists-btn.ct-btn-requesting {
        color: #334fff; border-color: #334fff;
        cursor: wait;
      }
      .ct-btn-spinner {
        display: inline-block; width: 16px; height: 16px;
        border: 2px solid currentColor; border-top-color: transparent;
        border-radius: 50%;
        animation: ct-btn-spin 0.7s linear infinite;
      }
      @keyframes ct-btn-spin { to { transform: rotate(360deg); } }
      .ct-btn-dot-pulse { display: inline-flex; gap: 4px; }
      .ct-btn-dot-pulse span {
        width: 5px; height: 5px; border-radius: 50%;
        background: currentColor;
        animation: ct-dot-bounce 1.2s ease-in-out infinite;
      }
      .ct-btn-dot-pulse span:nth-child(2) { animation-delay: 0.15s; }
      .ct-btn-dot-pulse span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes ct-dot-bounce {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1.1); }
      }

      /* === Change Email Button (bottom-left) === */
      #ct-change-email-btn {
        position: fixed; bottom: 12px; left: 12px; z-index: 99997;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 12px;
        background: rgba(255,255,255,0.9); color: #6b7280;
        border: 1px solid #e5e7eb; border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        font-size: 11px; font-weight: 500;
        cursor: pointer; transition: all 0.2s ease;
        backdrop-filter: blur(8px);
      }
      #ct-change-email-btn:hover {
        color: #334fff; border-color: #334fff;
        background: rgba(51, 79, 255, 0.06);
      }
      #ct-change-email-btn .ct-email-icon { font-size: 13px; }

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
      const children = activityHost.querySelectorAll(
        ':scope > *:not(#ct-talktrack-card)'
      );
      children.forEach((el) => el.remove());
    }
    const selectors = [
      '.activity:not(app-session-activity)',
      'app-activity',
      '[class*="activity-list"]',
      '[class*="activity-feed"]',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (
          !el.closest('app-session-activity') &&
          (el.offsetParent !== null || el.parentElement)
        ) {
          el.remove();
        }
      });
    }
  }

  // ================================================================
  // TALKTRACK PANEL
  // ================================================================

  function getActivityContainer() {
    return document.querySelector('app-session-activity');
  }

  const TT_SVG_16 =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
  const TT_SVG_32 = TT_SVG_16.replace(
    'width="16" height="16"',
    'width="32" height="32"'
  );

  function detectClientName() {
    if (!talkTrackMap) return null;
    const clientKeys = Object.keys(talkTrackMap);
    if (clientKeys.length === 0) return null;

    const pageText = document.body.innerText || '';
    const pageTextLower = pageText.toLowerCase();

    // Sort by length descending so longer keys match before shorter ones
    const sorted = clientKeys.slice().sort((a, b) => b.length - a.length);
    for (const key of sorted) {
      if (pageTextLower.includes(key)) {
        return key;
      }
    }
    return null;
  }

  function parseTalkTrackMarkdown(md) {
    // Strip custom color tags: {#rrggbb}text{/} → <span style="color:...">text</span>
    let html = md.replace(
      /\{(#[0-9a-fA-F]{6})\}([\s\S]*?)\{\/\}/g,
      '<span style="color:$1">$2</span>'
    );

    const lines = html.split('\n');
    const out = [];
    let inList = false;
    let inBlockquote = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Horizontal rule
      if (/^---+\s*$/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
        out.push('<hr>');
        continue;
      }

      // Headers
      if (/^### (.+)/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
        out.push('<h3>' + inlineFormat(line.replace(/^### /, '')) + '</h3>');
        continue;
      }
      if (/^## (.+)/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
        out.push('<h2>' + inlineFormat(line.replace(/^## /, '')) + '</h2>');
        continue;
      }
      if (/^# (.+)/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
        out.push('<h1>' + inlineFormat(line.replace(/^# /, '')) + '</h1>');
        continue;
      }

      // Blockquote
      if (/^>\s?(.*)/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        if (!inBlockquote) { out.push('<blockquote>'); inBlockquote = true; }
        out.push(inlineFormat(line.replace(/^>\s?/, '')) + '<br>');
        continue;
      } else if (inBlockquote) {
        out.push('</blockquote>');
        inBlockquote = false;
      }

      // List items (-, •, *)
      if (/^[\-\u2022\*]\s+(.+)/.test(line)) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inlineFormat(line.replace(/^[\-\u2022\*]\s+/, '')) + '</li>');
        continue;
      } else if (inList && line.trim() === '') {
        out.push('</ul>');
        inList = false;
      }

      // Empty line
      if (line.trim() === '') {
        continue;
      }

      // Regular paragraph
      out.push('<p>' + inlineFormat(line) + '</p>');
    }

    if (inList) out.push('</ul>');
    if (inBlockquote) out.push('</blockquote>');

    return out.join('\n');
  }

  function inlineFormat(text) {
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* (but not inside <span> color tags already processed)
    text = text.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
    return text;
  }

  async function fetchTalkTrack(filename) {
    if (talkTrackCache[filename]) return talkTrackCache[filename];
    try {
      const url = TALKTRACK_BASE_URL + filename + '.md?_=' + Date.now();
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) return null;
      const md = await resp.text();
      const html = parseTalkTrackMarkdown(md);
      talkTrackCache[filename] = html;
      return html;
    } catch (e) {
      log('TalkTrack fetch failed:', filename, e.message);
      return null;
    }
  }

  function tryShowTalkTrackPanel() {
    if (!IS_TOP_FRAME || !talkTrackMap) return;

    const clientKey = detectClientName();
    const filename = clientKey ? talkTrackMap[clientKey] : null;

    if (clientKey === currentTalkTrackKey) {
      ensureTalkTrackCardExists();
      return;
    }

    currentTalkTrackKey = clientKey;
    replaceTalkTrackCardContent(filename, clientKey);
  }

  function ensureTalkTrackCardExists() {
    if (document.getElementById('ct-talktrack-card')) return;
    const filename = currentTalkTrackKey ? talkTrackMap[currentTalkTrackKey] : null;
    replaceTalkTrackCardContent(filename, currentTalkTrackKey);
  }

  function replaceTalkTrackCardContent(filename, clientKey) {
    const oldCard = document.getElementById('ct-talktrack-card');
    if (oldCard) oldCard.remove();

    const container = getActivityContainer();
    if (!container) return;

    container.setAttribute('data-ct-talktrack-active', '');

    const card = document.createElement('div');
    card.id = 'ct-talktrack-card';

    if (filename) {
      const displayName = clientKey
        ? clientKey
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : 'Talk Track';
      const meta = talkTrackMeta[filename] || {};
      const websiteUrl = meta.website ? (meta.website.startsWith('http') ? meta.website : 'https://' + meta.website) : '';
      const websiteDisplay = meta.website ? meta.website.replace(/^https?:\/\//, '') : '';
      const bookingUrl = meta.booking_link ? (meta.booking_link.startsWith('http') ? meta.booking_link : 'https://' + meta.booking_link) : '';

      let headerLinks = '';
      if (websiteUrl) {
        headerLinks += `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="ct-tt-link"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>${websiteDisplay}</a>`;
      }
      if (bookingUrl) {
        headerLinks += `<a href="${bookingUrl}" target="_blank" rel="noopener noreferrer" class="ct-tt-link"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Book a meeting</a>`;
      }

      card.innerHTML = `
        <div class="ct-tt-header">
          ${TT_SVG_16}
          <span>Talk Track</span>
          <span class="ct-tt-client">${displayName}</span>
          ${headerLinks}
        </div>
        <div class="ct-tt-loading">
          <div class="ct-tt-spinner"></div>
        </div>
      `;

      container.appendChild(card);
      optimizeLayout(true);

      // Fetch and render markdown
      fetchTalkTrack(filename).then((html) => {
        const currentCard = document.getElementById('ct-talktrack-card');
        if (!currentCard) return;
        const loader = currentCard.querySelector('.ct-tt-loading');
        if (html) {
          const body = document.createElement('div');
          body.className = 'ct-tt-body';
          body.innerHTML = html;
          if (loader) loader.remove();
          currentCard.appendChild(body);
          log('TalkTrack loaded:', filename);
        } else {
          if (loader) {
            loader.className = 'ct-tt-empty';
            loader.innerHTML = `${TT_SVG_32}<div>Failed to load talk track.<br>Check your connection and try again.</div>`;
          }
        }
      });
    } else {
      card.innerHTML = `
        <div class="ct-tt-header">
          ${TT_SVG_16}
          <span>Talk Track</span>
        </div>
        <div class="ct-tt-empty">
          ${TT_SVG_32}
          <div>No talk track found for this campaign.<br>
          The talk track will appear automatically when a matching client is detected.</div>
        </div>
      `;
      container.appendChild(card);
      optimizeLayout(true);
    }
  }

  function removeTalkTrackPanel() {
    const card = document.getElementById('ct-talktrack-card');
    if (card) card.remove();
    const container = getActivityContainer();
    if (container) container.removeAttribute('data-ct-talktrack-active');
    currentTalkTrackKey = null;
    optimizeLayout(false);
  }

  function optimizeLayout(enable) {
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

  function startTalkTrackPolling() {
    if (window._ctTalkTrackPollActive) return;
    window._ctTalkTrackPollActive = true;
    setInterval(tryShowTalkTrackPanel, TALKTRACK_POLL_MS);
  }

  // ================================================================
  // CONFIG (remote talk track mapping)
  // ================================================================

  async function fetchRemoteConfig() {
    if (!IS_TOP_FRAME) return;
    try {
      const resp = await fetch(CONFIG_URL + '?_=' + Date.now(), {
        cache: 'no-store',
      });
      if (!resp.ok) return;
      const config = await resp.json();
      talkTrackMap = config.talkTrackMap || {};
      talkTrackMeta = config.talkTrackMeta || {};

      // Remote cache clear: bump clearCacheVersion in config.json to wipe all SDR caches
      const remoteCacheVer = config.clearCacheVersion || 0;
      const localCacheVer = parseInt(
        localStorage.getItem('ct-clear-cache-version') || '0',
        10
      );
      if (remoteCacheVer > localCacheVer) {
        log('Remote cache clear: v' + localCacheVer + ' → v' + remoteCacheVer);
        localStorage.removeItem(CAMPAIGN_CACHE_KEY);
        localStorage.removeItem(BATCH_STORAGE_KEY);
        // Clear talk track cache so fresh content is fetched
        talkTrackCache = {};
        localStorage.setItem('ct-clear-cache-version', String(remoteCacheVer));
      }

      log(
        'Config loaded: TalkTrack map:',
        Object.keys(talkTrackMap).length,
        'clients'
      );

      // Start polling and show panel immediately
      tryShowTalkTrackPanel();
      startTalkTrackPolling();
    } catch (e) {
      log('Config fetch failed:', e.message);
    }
  }

  function expandDispositionsOnce() {
    const showMoreBtn = document.querySelector(
      '.session-dispositions__show-more button'
    );
    if (showMoreBtn && showMoreBtn.textContent.includes('Show More')) {
      log('Expanding dispositions...');
      showMoreBtn.click();
      return true;
    }
    return false;
  }

  function getActionableDispositions() {
    const allChips = document.querySelectorAll(
      'cds-call-disposition .cds-chip'
    );
    const actionable = [];
    for (const chip of allChips) {
      const isInActivity = chip.closest(
        '.activity, [class*="activity"], .session-activity, app-activity'
      );
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

    document.querySelectorAll('[data-ct-badge]').forEach((el) => el.remove());

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

    const hangupBtn = document.querySelector(
      'app-button.hangup, .control-btn.hangup'
    );
    if (hangupBtn && !hangupBtn.querySelector('[data-ct-badge]')) {
      const btn = hangupBtn.querySelector('button') || hangupBtn;
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.appendChild(createBadge('0', 'danger'));
    }

    const nextCallBtn = document.querySelector(
      '[data-test-id="next-call-btn"]'
    );
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
    tryShowTalkTrackPanel();
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
        const btn =
          element.tagName === 'BUTTON'
            ? element
            : element.querySelector('button') || element;
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
        const btn =
          element.tagName === 'BUTTON'
            ? element
            : element.querySelector('button') || element;
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
    dispositions.forEach((d) => d.classList.remove('ct-disposition-selected'));
    const disposition = dispositions[index];
    const badge = disposition.querySelector('[data-ct-badge]');
    const name = badge
      ? disposition.textContent.replace(badge.textContent, '').trim()
      : disposition.textContent.trim();
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
      ${
        type === 'success'
          ? 'background: #d1faec; color: #0f8960; border: 1px solid #0f8960;'
          : 'background: #fae6e6; color: #aa322e; border: 1px solid #aa322e;'
      }
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
      const lastTag = status.isLastBlock
        ? ' \u00B7 Free calling after this block'
        : '';
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

    overlay.querySelectorAll('[data-ct-pick]').forEach((btn) => {
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
        Leave and rejoin to refresh your calling list.${
          nextInfo ? ' \u00B7 ' + nextInfo : ''
        }
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
      const resp = await fetch(UPDATE_XML_URL + '?_=' + cacheBuster, {
        cache: 'no-store',
      });
      if (!resp.ok) return;
      const xml = await resp.text();
      const match = xml.match(/version='([^']+)'/);
      if (!match) return;
      const remoteVersion = match[1];
      log(
        'Version check: local=' + CURRENT_VERSION + ' remote=' + remoteVersion
      );
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
  // OUTBOUND NUMBER ENFORCEMENT — lock to "Random"
  // ================================================================

  function enforceAutomaticOutbound() {
    if (!IS_TOP_FRAME || !isSessionPage()) return;

    const label = document.querySelector('[data-test-id="OutboundMainLabel"]');
    if (!label) return;

    const current = label.textContent.trim();
    if (current !== 'Random') {
      log('Outbound not Random (' + current + ') — clicking to open selector');
      const btn = document.querySelector(
        '[data-test-id="OutboundSelectButton"]'
      );
      if (btn) {
        btn.click();
        setTimeout(() => {
          for (const opt of document.querySelectorAll(
            'app-outbound-select button, [class*="outbound"] button, [class*="select-option"]'
          )) {
            if (opt.textContent.includes('Random')) {
              opt.click();
              log('Outbound forced to Random');
              return;
            }
          }
          // If we can't find the Random option in dropdown, try pressing Escape
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          );
        }, 500);
      }
    }

    // Lock the selector: prevent pointer events on the outbound select
    const selectEl = document.querySelector('app-outbound-select');
    if (selectEl && !selectEl.hasAttribute('data-ct-locked')) {
      selectEl.setAttribute('data-ct-locked', 'true');
      selectEl.style.pointerEvents = 'none';
      selectEl.style.opacity = '0.7';
      selectEl.title = 'Outbound number is locked to Random by company policy';
    }
  }

  // ================================================================
  // CAMPAIGN EMPTY CHECK & REQUEST NEW LISTS
  // ================================================================

  let _ctCachedAccessToken = null;
  let _ctAccessTokenExp = 0;

  async function getCloudTalkBearerToken() {
    // Return cached token if still valid (with 60s buffer)
    if (_ctCachedAccessToken && Date.now() < _ctAccessTokenExp - 60000) {
      return _ctCachedAccessToken;
    }

    try {
      // Call refresh-token endpoint on auth subdomain (cookies sent cross-subdomain)
      const resp = await fetch(
        'https://auth.cloudtalk.io/ct-auth/api/auth/refresh-token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );
      if (!resp.ok) throw new Error('Refresh token failed: ' + resp.status);
      const json = await resp.json();

      // Extract access token from response
      const token =
        json.accessToken ||
        json.access_token ||
        json.token ||
        (json.data &&
          (json.data.accessToken || json.data.access_token || json.data.token));
      if (!token) throw new Error('No access token in response');

      // Cache it and extract expiry
      _ctCachedAccessToken = token;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        _ctAccessTokenExp = (payload.exp || 0) * 1000;
      } catch (_) {
        _ctAccessTokenExp = Date.now() + 30 * 60 * 1000; // fallback 30min
      }

      log('Campaign check: obtained access token');
      return token;
    } catch (e) {
      log('Campaign check: failed to get token:', e.message);
      return null;
    }
  }

  function getCampaignCache() {
    try {
      const raw = localStorage.getItem(CAMPAIGN_CACHE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  }

  function setCampaignCache(cache) {
    localStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(cache));
  }

  function isCampaignCachedWithData(campaignId) {
    const cache = getCampaignCache();
    const entry = cache[String(campaignId)];
    if (!entry) return false;
    if (Date.now() - entry.ts > CAMPAIGN_CACHE_TTL_MS) return false;
    return entry.hasData === true;
  }

  function cacheCampaignResult(campaignId, hasData) {
    const cache = getCampaignCache();
    cache[String(campaignId)] = { hasData: hasData, ts: Date.now() };
    setCampaignCache(cache);
  }

  function isCampaignCachedAsEmpty(campaignId) {
    const cache = getCampaignCache();
    const entry = cache[String(campaignId)];
    if (!entry) return false;
    if (Date.now() - entry.ts > CAMPAIGN_CACHE_TTL_MS) return false;
    return entry.hasData === false;
  }

  async function fetchActiveCampaigns(token) {
    const url = CAMPAIGNS_API_BASE + '/active?offsetId=&order=DESC&amount=20';
    const resp = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!resp.ok) throw new Error('Failed to fetch campaigns: ' + resp.status);
    const json = await resp.json();
    if (!json.success) throw new Error('API returned success=false');
    return json.data || [];
  }

  async function checkCampaignHasContacts(campaignId, token) {
    const assignUrl =
      CAMPAIGNS_API_BASE + '/' + campaignId + '/contacts/assign?amount=15';
    const resp = await fetch(assignUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!resp.ok)
      throw new Error(
        'Assign failed for campaign ' + campaignId + ': ' + resp.status
      );
    const json = await resp.json();
    const contacts = json.data || [];

    if (contacts.length > 0) {
      // Has contacts — unassign immediately to release them
      const unassignUrl =
        CAMPAIGNS_API_BASE + '/' + campaignId + '/contacts/unassign';
      await fetch(unassignUrl, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      return true;
    }
    return false;
  }

  async function checkAllCampaignsEmpty() {
    if (!IS_TOP_FRAME || !isCampaignListPage()) return;

    const token = await getCloudTalkBearerToken();
    if (!token) {
      log('Campaign check: no bearer token found');
      return;
    }

    // Block all campaign clicks while checks run
    const listContainer =
      document.querySelector('.cds-list') ||
      document.querySelector('cds-list-item')?.parentElement;
    if (listContainer) listContainer.classList.add('ct-campaigns-checking');

    log('Campaign check: fetching active campaigns...');

    try {
      const campaigns = await fetchActiveCampaigns(token);
      if (campaigns.length === 0) {
        log('Campaign check: no active campaigns — enabling button');
        enableRequestNewListsButton();
        return;
      }

      log('Campaign check: checking', campaigns.length, 'campaigns...');

      let allEmpty = true;
      for (const campaign of campaigns) {
        // Use cache if available
        if (isCampaignCachedWithData(campaign.id)) {
          log(
            'Campaign check:',
            campaign.name,
            '(#' + campaign.id + ') — cached WITH data'
          );
          highlightCampaignRow(campaign.name);
          allEmpty = false;
          continue;
        }
        if (isCampaignCachedAsEmpty(campaign.id)) {
          log(
            'Campaign check:',
            campaign.name,
            '(#' + campaign.id + ') — cached EMPTY'
          );
          greyCampaignRow(campaign.name);
          continue;
        }

        // Skip expensive assign/unassign fetch when stats show zero contacts
        const scheduled = campaign.totalScheduledCalls || 0;
        const dropped = campaign.totalDroppedToRepeatContacts || 0;
        const fresh = campaign.totalFreshContacts || 0;
        if (scheduled === 0 && dropped === 0 && fresh === 0) {
          log(
            'Campaign check:',
            campaign.name,
            '(#' + campaign.id + ') — stats all zero, auto-EMPTY'
          );
          cacheCampaignResult(campaign.id, false);
          greyCampaignRow(campaign.name);
          continue;
        }

        try {
          const hasContacts = await checkCampaignHasContacts(
            campaign.id,
            token
          );
          cacheCampaignResult(campaign.id, hasContacts);
          log(
            'Campaign check:',
            campaign.name,
            '(#' + campaign.id + ') —',
            hasContacts ? 'HAS contacts' : 'EMPTY'
          );
          if (hasContacts) {
            highlightCampaignRow(campaign.name);
            allEmpty = false;
          } else {
            greyCampaignRow(campaign.name);
          }
        } catch (e) {
          log('Campaign check: error checking', campaign.name, ':', e.message);
          allEmpty = false;
        }
      }

      if (allEmpty) {
        log('Campaign check: ALL campaigns empty — enabling button NOW!!!!');
        enableRequestNewListsButton();
      } else {
        disableRequestNewListsButton();
      }
    } catch (e) {
      log('Campaign check: error:', e.message);
    } finally {
      // Unblock campaign clicks now that checks are done
      if (listContainer)
        listContainer.classList.remove('ct-campaigns-checking');
    }
  }

  function findCampaignRow(campaignName) {
    const decoded = campaignName
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    const labels = document.querySelectorAll('.cds-list-item__label');
    for (const label of labels) {
      const text = label.textContent.trim();
      if (text === campaignName || text === decoded) {
        return (
          label.closest('cds-list-item') ||
          label.closest('.cds-list-item')?.parentElement ||
          label.parentElement?.parentElement
        );
      }
    }
    return null;
  }

  function highlightCampaignRow(campaignName) {
    const row = findCampaignRow(campaignName);
    if (row && !row.classList.contains('ct-campaign-has-data')) {
      row.classList.add('ct-campaign-has-data');
    }
  }

  function greyCampaignRow(campaignName) {
    const row = findCampaignRow(campaignName);
    if (row && !row.classList.contains('ct-campaign-empty')) {
      row.classList.add('ct-campaign-empty');
    }
  }

  function ensureRequestNewListsButton(attempt) {
    attempt = attempt || 1;
    let btn = document.getElementById('ct-request-lists-btn');
    if (btn) return Promise.resolve(btn);

    const header = document.querySelector('.cds-header');
    if (!header) {
      if (attempt < 30) {
        log('Button: .cds-header not found, retry ' + attempt + '/30');
        return new Promise((resolve) => {
          setTimeout(
            () => resolve(ensureRequestNewListsButton(attempt + 1)),
            1000
          );
        });
      }
      log('Button: .cds-header not found after 30 attempts, giving up');
      return Promise.resolve(null);
    }
    btn = document.createElement('button');
    btn.id = 'ct-request-lists-btn';
    btn.disabled = true;
    btn.onclick = handleRequestNewLists;
    log('Button: inserting into .cds-header (attempt ' + attempt + ')');
    header.appendChild(btn);
    setButtonState(btn, 'checking');
    return Promise.resolve(btn);
  }

  function setButtonState(btn, state) {
    btn.className = '';
    switch (state) {
      case 'checking':
        btn.disabled = true;
        btn.classList.add('ct-btn-checking');
        btn.innerHTML =
          '<span class="ct-btn-spinner"></span> Checking campaigns';
        break;
      case 'unavailable':
        btn.disabled = true;
        btn.classList.add('ct-btn-unavailable');
        btn.innerHTML = 'Campaigns have contacts — no request needed';
        break;
      case 'ready':
        btn.disabled = false;
        btn.innerHTML = 'All campaigns empty — Request New Lists';
        break;
      case 'requesting':
        btn.disabled = true;
        btn.classList.add('ct-btn-requesting');
        btn.innerHTML =
          '<span class="ct-btn-spinner"></span> Requesting new lists<span class="ct-btn-dot-pulse"><span></span><span></span><span></span></span>';
        break;
    }
  }

  async function enableRequestNewListsButton() {
    const btn = await ensureRequestNewListsButton();
    if (btn) setButtonState(btn, 'ready');
  }

  async function disableRequestNewListsButton() {
    const btn = await ensureRequestNewListsButton();
    if (btn) setButtonState(btn, 'unavailable');
  }

  async function handleRequestNewLists() {
    const btn = document.getElementById('ct-request-lists-btn');
    if (btn) setButtonState(btn, 'requesting');

    const email = detectAgentEmail();
    if (!email) {
      showNotification(
        'Something went wrong — please try again later',
        'error'
      );
      if (btn) setButtonState(btn, 'unavailable');
      return;
    }

    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'proxyFetch',
            url: THROXY_API_BASE + '/cpt/request-new-lists',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + THROXY_MACHINE_TOKEN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email }),
          },
          (response) => {
            if (chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message));
            else resolve(response);
          }
        );
      });

      log(
        'Request new lists: payload:',
        { email: email },
        'response:',
        resp.status,
        resp.body
      );
      if (!resp.ok) throw new Error('Request failed: ' + resp.status);
      const json = JSON.parse(resp.body);
      if (!json.success) throw new Error('API returned success=false');

      log('Request new lists: success for', email);
      showNotification('New lists requested! Refreshing...', 'success');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Refreshing...';
      }
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      log('Request new lists: error:', e.message);
      showNotification(
        'Something went wrong — please try again later',
        'error'
      );
      if (btn) setButtonState(btn, 'unavailable');
    }
  }

  function ensureChangeEmailButton() {
    if (document.getElementById('ct-change-email-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ct-change-email-btn';
    const email = detectAgentEmail();
    btn.innerHTML =
      '<span class="ct-email-icon">\u2709\uFE0F</span>' +
      (email || 'No email set');
    btn.onclick = () => {
      const current = detectAgentEmail() || '';
      const input = prompt('Enter your Throxy email:', current);
      if (input === null) return; // cancelled
      const trimmed = input.trim().toLowerCase();
      if (!trimmed) {
        localStorage.removeItem(LINKEDIN_USER_KEY);
        btn.innerHTML =
          '<span class="ct-email-icon">\u2709\uFE0F</span>No email set';
        log('Email cleared');
        return;
      }
      localStorage.setItem(LINKEDIN_USER_KEY, trimmed);
      btn.innerHTML =
        '<span class="ct-email-icon">\u2709\uFE0F</span>' + trimmed;
      log('Email changed to:', trimmed);
    };
    document.body.appendChild(btn);
  }

  // SPA navigation detection for campaign list page
  let _ctLastCampaignUrl = '';
  let _ctCampaignCheckRunning = false;
  function checkCampaignListNavigation() {
    const currentUrl = window.location.href;
    const urlChanged = currentUrl !== _ctLastCampaignUrl;
    _ctLastCampaignUrl = currentUrl;

    if (isCampaignListPage()) {
      ensureChangeEmailButton();
      // Button missing from DOM (Angular rebuilt the view) — re-inject
      const btnExists = document.getElementById('ct-request-lists-btn');
      const wrapperExists = document.querySelector('.cds-header');
      if (!btnExists && wrapperExists) {
        if (!_ctCampaignCheckRunning) {
          _ctCampaignCheckRunning = true;
          ensureRequestNewListsButton().then(() =>
            checkAllCampaignsEmpty().finally(() => {
              _ctCampaignCheckRunning = false;
            })
          );
        }
      } else if (urlChanged) {
        log('Campaign list page detected — starting campaign check');
        setTimeout(() => {
          if (!_ctCampaignCheckRunning) {
            _ctCampaignCheckRunning = true;
            ensureRequestNewListsButton().then(() =>
              checkAllCampaignsEmpty().finally(() => {
                _ctCampaignCheckRunning = false;
              })
            );
          }
        }, 2000);
      }
    } else {
      const btn = document.getElementById('ct-request-lists-btn');
      if (btn) btn.remove();
      const emailBtn = document.getElementById('ct-change-email-btn');
      if (emailBtn) emailBtn.remove();
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
    if (isTypingInInput(event)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const key = event.key;

    if (key === '+' || key === '=') {
      event.preventDefault();
      nextCall();
      return;
    }

    if (key === '0') {
      event.preventDefault();
      hangUp();
      return;
    }

    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      selectDisposition(parseInt(key, 10) - 1);
      return;
    }

    if (key.toLowerCase() === 'q') {
      event.preventDefault();
      selectDisposition(9);
      return;
    }
    if (key.toLowerCase() === 'w') {
      event.preventDefault();
      selectDisposition(10);
      return;
    }
    if (key.toLowerCase() === 'e') {
      event.preventDefault();
      selectDisposition(11);
      return;
    }
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

    // Enforce Random outbound number selection
    setTimeout(enforceAutomaticOutbound, 2000);
    setInterval(enforceAutomaticOutbound, CHECK_INTERVAL_MS);

    // Campaign empty check (SPA navigation detection)
    checkCampaignListNavigation();
    setInterval(checkCampaignListNavigation, 3000);

    // TalkTrack panel starts after config is fetched (in fetchRemoteConfig)
    setTimeout(tryShowTalkTrackPanel, 2000);

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
      navigator.permissions.query({ name: 'microphone' }).then((permStatus) => {
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
    if (t.id === 'ct-talktrack-card' || t.id === 'ct-talktrack-card') return true;
    if (t.closest?.('#ct-talktrack-card') || t.closest?.('#ct-talktrack-card'))
      return true;
    if (
      t.tagName === 'APP-SESSION-ACTIVITY' ||
      t.closest?.('app-session-activity')
    ) {
      const isOurNode = (n) =>
        n?.id === 'ct-talktrack-card' ||
        n?.id === 'ct-talktrack-card' ||
        (n?.nodeType === 1 && n?.hasAttribute?.('data-ct-talktrack-active'));
      for (const n of m.addedNodes || []) {
        if (isOurNode(n)) return true;
      }
      for (const n of m.removedNodes || []) {
        if (isOurNode(n)) return true;
      }
    }
    return false;
  }
  const observer = new MutationObserver((mutations) => {
    const dominated = mutations.every((m) => {
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

  const targetNode =
    document.querySelector('app-session, app-dialer, main') || document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });

  document.addEventListener('keydown', handleKeyDown, true);
  log('Extension ready (schedules + mic warning + TalkTrack panel)');
})();
