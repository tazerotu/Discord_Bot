# Discord Bot Collection

This repository contains several independent Discord bot projects built with JavaScript and `discord.js`. Each folder is its own bot with a different purpose, so the repo acts more like a collection of experiments and utilities than a single application.

## Repository overview

- `wynncraft 2/` — the most complete and active project; a Wynncraft server tracker and event bot with slash commands, live polling, and optional pinned tracker messages.
- `Wynncraft/` — earlier Wynncraft-focused bot experiments and utilities.
- `Warframe/` — Warframe helper bot for relic data, drop locations, and market price lookups.
- `DGA/` — a simpler Discord bot that welcomes members and responds to basic commands.

## What's in this repo?

### 1) Wynncraft bot (`wynncraft 2`)

This is the flagship project in the repo.

Features:
- live Wynncraft world event tracking
- region filtering (`US`, `EU`, `AS`)
- slash commands such as `/events`, `/search`, `/server`, and `/profspots`
- optional pinned tracker message that auto-refreshes in a Discord channel
- profession gathering spot recommendations

Suggested setup:

```bash
cd "wynncraft 2"
npm install
cp .env.example .env
```

Then configure your environment:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
TRACKER_CHANNEL_ID=optional_channel_id_for_live_tracker
```

Run:

```bash
node index.js
```

### 2) Warframe bot (`Warframe`)

This bot queries Warframe wiki and market data to provide:
- relic lookup
- drop locations by mission
- prime item information
- market price summaries from Warframe.market

Run it from the `Warframe` folder:

```bash
cd Warframe
npm install
node warframe.js
```

### 3) DGA bot (`DGA`)

A lightweight server bot focused on simple Discord automation, including:
- welcome messages for new users
- basic prefix commands like `!ping` and `!hello`

Run it from the `DGA` folder:

```bash
cd DGA
npm install
node DGA.js
```

## Requirements

- Node.js 18+
- npm
- a Discord bot token and application ID
- optional environment file setup depending on the bot you are running

## Notes

- Each directory is effectively its own project and has its own `package.json`.
- The repository root is intentionally minimal and is not a single deployable app.
- Some folders contain older or experimental code that may not be maintained as actively as the main Wynncraft project.

## Recommended starting point

If you want to explore the most complete example, start with:

```bash
cd "wynncraft 2"
```

Then install dependencies, add the required environment variables, and run the bot.

## License

This project is licensed under the MIT License. See `LICENSE` for more information.
