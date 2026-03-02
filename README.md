# CloudTalk Disposition Shortcuts

Chrome extension for Throxy's CloudTalk Parallel Dialer. Adds keyboard shortcuts, schedule awareness, headset mic warnings, and an inline LinkedIn prospect panel.

## Repo Structure

| Path | Purpose |
|------|---------|
| `src/` | **Readable source code** — edit these files when making changes |
| `cloudtalk-shortcuts.crx` | Packed extension binary served to users via auto-update |
| `updates.xml` | Auto-update manifest (Chrome checks this periodically) |
| `config.json` | LinkedIn A/B test whitelist (fetched at runtime) |

## How to Make Changes

The `src/` directory contains the same files that are packed into the `.crx`. When you need to change the extension:

1. **Edit the source files** in `src/` (e.g. `src/content.js`, `src/manifest.json`)
2. **Bump the version** in `src/manifest.json`
3. **Repack the CRX:**
   - Open `chrome://extensions` in Chrome
   - Enable **Developer mode** (top right)
   - Click **Pack extension** → set "Extension root directory" to the `src/` folder
   - This produces a new `src.crx` — rename it to `cloudtalk-shortcuts.crx` and move it to the repo root
4. **Update `updates.xml`** at the repo root — set the `version` attribute to match the new version
5. **Commit and push** — GitHub Pages serves the CRX and update manifest automatically

Users' Chrome browsers will pick up the new version within ~30 minutes (or on restart).

## Features

| Feature | Description |
|---------|-------------|
| **Keyboard shortcuts** | `0` = Hang up · `1`–`9` = Dispositions 1–9 · `Q`/`W`/`E` = Dispositions 10/11/12 · `+` = Next Call |
| **Schedule awareness** | Status banner showing current time block. Warning banner during breaks (non-blocking since v1.4.0) |
| **Headset mic check** | Warns when default mic is Realtek (laptop) instead of headset |
| **LinkedIn panel** | Inline LinkedIn profile in the activity column (A/B test, whitelist in `config.json`) · Toggle: `Ctrl+Shift+L` |
| **Auto-update** | Checks `updates.xml` every 30 minutes, shows banner when new version is available |

## Time Block Schedules (South Africa time)

Defined in `src/content.js`. Users pick Morning or Afternoon once per day.

**Morning:**
| Block | Time |
|-------|------|
| 1 | 10:15 – 11:15 |
| 2 | 11:30 – 13:00 |
| 3 | 14:15 – 15:15 |
| 4 | 15:30 – 16:30 |
| 5 | 17:00 – 17:45 |
| 6 | 18:00 – 19:00 |

**Afternoon:**
| Block | Time |
|-------|------|
| 1 | 13:00 – 14:00 |
| 2 | 14:15 – 15:15 |
| 3 | 15:30 – 16:30 |
| 4 | 16:45 – 18:15 |
| 5 | 19:30 – 20:30 |
| 6 | 20:45 – 21:30 |

**Important:** These schedules are in the extension only for *warning* purposes. The actual call-blocking time blocks are configured in the **CloudTalk campaign settings** on the CloudTalk dashboard. If agents are being blocked from calling, check the campaign time blocks in CloudTalk first.

## Distribution

- **Extension ID:** `aakeecjanhlnagakgfljfnbdfaolphpe`
- **Update URL:** `https://throxy-ai.github.io/cloudtalk-extension/updates.xml`
- **CRX URL:** `https://throxy-ai.github.io/cloudtalk-extension/cloudtalk-shortcuts.crx`
- Deployed via **Google Workspace Admin Console** (force-install)
- Served from **GitHub Pages** (main branch)

## Key DOM Selectors (CloudTalk)

For reference when troubleshooting selector breakage after CloudTalk UI updates:

| Element | Selector |
|---------|----------|
| Dispositions | `cds-call-disposition .cds-chip` |
| Hang up | `app-button.hangup button` |
| Next Call | `[data-test-id="next-call-btn"]` |
| Show More | `.session-dispositions__show-more button` |
| Activity container | `app-session-activity` |
