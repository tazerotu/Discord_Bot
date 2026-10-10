# Wynncraft World Events Discord Bot

A Discord bot that **live-tracks world events** across all Wynncraft servers, organized by region (US / EU / AS). It auto-updates a pinned message every 30 seconds and supports slash commands for querying.

---

## Features

| Command | Description |
|---|---|
| `/events` | Full overview of all servers & active world events by region |
| `/search <name>` | Find which servers have a specific world event active |
| `/server <name>` | Info + events for one server (e.g. `WC1`, `EU3`, `AS2`) |
| `/region <US/EU/AS>` | All servers in one region with their events |
| `/settracker` | Pin a live-updating embed in the current channel (admin) |
| `/stoptracker` | Stop the live tracker (admin) |

---

## Setup

### 1. Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to **Bot** → click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it
5. Enable **Message Content Intent** and **Server Members Intent** under Privileged Gateway Intents
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Manage Messages` (for pinning)
7. Copy the generated URL, open it in a browser, and add the bot to your server

### 2. Install & Configure

```bash
# Install dependencies
npm install

# Copy the example env file
cp .env.example .env
```

Edit `.env`:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id      # Found on the General Information page
TRACKER_CHANNEL_ID=                 # Optional: auto-set the live tracker channel
```

### 3. Run

```bash
node index.js
```

Or with auto-restart on crash:
```bash
npx pm2 start index.js --name wynncraft-bot
```

---

## Live Tracker

Use `/settracker` in any channel (requires Manage Channels permission). The bot will:
1. Post an embed showing all servers grouped by region (US / EU / AS)
2. Pin the message
3. Edit it every **30 seconds** with the latest data

Use `/stoptracker` to stop it.

---

## API Notes

The bot uses the **Wynncraft Public API v3** (`https://api.wynncraft.com/v3`).

- Server list: `GET /map/gameSessions/servers`
- World events: `GET /map/world-events` (tried automatically; falls back gracefully if not available)
- Rate limit: 50 req/min (guest) — the bot polls at 30s intervals, well within limits

Servers are categorized by prefix:
| Prefix | Region |
|---|---|
| `WC` | US |
| `US` | US |
| `EU` | EU |
| `AS` | AS |

---

## Customization

**Add more event names** — edit the `WORLD_EVENT_NAMES` array in `index.js`.

**Change poll interval** — edit `POLL_INTERVAL_MS` (default `30000` = 30 seconds). Don't go below 10s to avoid rate limits.

**Multiple tracker channels** — the bot currently supports one tracker channel at a time. You can expand `trackerChannelId` to an array if needed.
