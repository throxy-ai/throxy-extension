# Throxy Extension

Chrome extension for Throxy SDR operations. Includes CloudTalk keyboard shortcuts, schedule awareness, headset mic warnings, LinkedIn prospect panel, and cal.com booking validations (timezone mismatch, email deliverability, notes blocker).

## Repo Structure

| Path | Purpose |
|------|---------|
| `src/` | **Readable source code** — edit these files when making changes |
| `throxy-extension.crx` | Packed extension binary served to users via auto-update |
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
   - This produces a new `src.crx` — rename it to `throxy-extension.crx` and move it to the repo root
4. **Update `updates.xml`** at the repo root — set the `version` attribute to match the new version
5. **Commit and push** — Vercel serves the CRX and update manifest automatically

Users' Chrome browsers will pick up the new version within ~30 minutes (or on restart).

## Features

| Feature | Description |
|---------|-------------|
| **Keyboard shortcuts** | `0` = Hang up · `1`–`9` = Dispositions 1–9 · `Q`/`W`/`E` = Dispositions 10/11/12 · `+` = Next Call |
| **Schedule awareness** | Status banner showing current time block. Warning banner during breaks (non-blocking since v1.4.0) |
| **Headset mic check** | Warns when default mic is Realtek (laptop) instead of headset |
| **LinkedIn panel** | Inline LinkedIn profile in the activity column (A/B test, whitelist in `config.json`) · Toggle: `Ctrl+Shift+L` |
| **Auto-update** | Checks `updates.xml` every 30 minutes, shows banner when new version is available |
| **Cal.com timezone check** | Flags phone ↔ timezone mismatches on cal.com booking pages |
| **Cal.com email validation** | Verifies email deliverability via BounceBan API; blocks booking for undeliverable emails |
| **Cal.com notes blocker** | Hides the "Additional notes" field on cal.com booking pages |

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
- **Update URL:** `https://throxy-extension.throxy.ai/updates.xml`
- **CRX URL:** `https://throxy-extension.throxy.ai/throxy-extension.crx`
- Deployed via **Google Workspace Admin Console** (force-install)
- Served from **Vercel** (main branch)

### Enforcing Incognito Mode

The extension has `"incognito": "spanning"` in the manifest so it works in incognito. To **force** it to run in incognito (users can't disable it), set this in the **Google Workspace Admin Console**:

> Devices → Chrome → Apps & extensions → Users & browsers → Throxy Extension → Allow in incognito: **Force**

Or via the `ExtensionSettings` policy:
```json
{
  "aakeecjanhlnagakgfljfnbdfaolphpe": {
    "installation_mode": "force_installed",
    "update_url": "https://throxy-extension.throxy.ai/updates.xml",
    "incognito": "force"
  }
}
```

## Key DOM Selectors (CloudTalk)

For reference when troubleshooting selector breakage after CloudTalk UI updates:

| Element | Selector |
|---------|----------|
| Dispositions | `cds-call-disposition .cds-chip` |
| Hang up | `app-button.hangup button` |
| Next Call | `[data-test-id="next-call-btn"]` |
| Show More | `.session-dispositions__show-more button` |
| Activity container | `app-session-activity` |
