# Discord Bot Collection

A collection of independent Discord bots built with JavaScript and [discord.js](https://discord.js.org/). Each bot lives in its own directory, has its own dependencies, and can be installed and run separately.

> **Important:** The repository root is not one single deployable application. Choose a bot directory before installing dependencies or starting a bot.

## Contents

- [Projects](#projects)
- [Requirements](#requirements)
- [Discord application setup](#discord-application-setup)
- [Running a bot](#running-a-bot)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Projects

### `wynncraft 2` — Wynncraft world-events bot

The most complete project in this repository. It tracks Wynncraft world events across servers and regions, then exposes the information through Discord slash commands.

Features include:

- World-event and server tracking through the Wynncraft Public API
- Region views for US, EU, and AS servers
- Slash commands including `/events`, `/search`, `/server`, `/region`, `/settracker`, and `/stoptracker`
- An optional pinned tracker message that refreshes automatically
- Profession gathering-spot recommendations

See the dedicated [Wynncraft bot README](wynncraft%202/README.md) for the full command reference, Discord permissions, API notes, and customization details.

### `Warframe` — Warframe lookup bot

A prefix-command bot for Warframe relics and items. It combines data from the Warframe Wiki and Warframe.market and returns formatted Discord embeds.

Available commands:

- `!relic <name>` — relic drops, rarity chances, mission locations, and market prices
- `!item <name>` — Prime-item parts and relics, or regular-item drop and market information
- `!wfhelp` — display the bot's built-in help message

The bot reads its token from `Warframe/config.json` and starts from `warframe.js`.

### `DGA` — lightweight server utility bot

A simple prefix-command bot that demonstrates basic Discord automation:

- Welcomes new members in a channel named `systeme`
- `!ping` replies with `Pong!`
- `!hello` greets the user who invoked the command

The bot reads its token from `DGA/config.json` and starts from `DGA.js`.

### `Wynncraft` — earlier experiments

This directory contains earlier Wynncraft-focused experiments and utilities. It may not have the same setup or feature completeness as `wynncraft 2`; inspect its files before running it.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer is recommended
- npm
- A Discord application and bot token
- Appropriate Discord intents and permissions for the bot you want to run

Check the individual `package.json` files for each bot's dependencies. Do not run `npm install` from the repository root because there is no root-level application package.

## Discord application setup

For a new bot:

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application and open its **Bot** page.
3. Add a bot and copy its token. Treat the token like a password.
4. Enable the privileged intents required by the selected bot:
   - **Message Content Intent** is required by the prefix-command bots.
   - **Server Members Intent** is required by `DGA` for member-join welcome messages.
5. Under **OAuth2 → URL Generator**, select the `bot` scope. For the slash-command bot, also select `applications.commands`.
6. Grant only the permissions the bot needs. Typical permissions include **View Channels**, **Send Messages**, **Embed Links**, and **Read Message History**. The Wynncraft tracker also needs permission to pin or manage messages when using tracker commands.
7. Open the generated invite URL and add the bot to your server.

## Running a bot

Clone the repository, then work inside the directory for the bot you want to run:

```bash
git clone https://github.com/tazerotu/Discord_Bot.git
cd Discord_Bot
```

### Wynncraft bot

```bash
cd "wynncraft 2"
npm install
cp .env.example .env
```

Set the values in `.env`:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_discord_application_id
TRACKER_CHANNEL_ID=optional_channel_id
```

Start the bot with:

```bash
node index.js
```

For additional setup and command details, read [`wynncraft 2/README.md`](wynncraft%202/README.md).

### Warframe bot

Create `Warframe/config.json` with your bot token:

```json
{
  "token": "your_bot_token"
}
```

Then install dependencies and start the bot:

```bash
cd Warframe
npm install
node warframe.js
```

### DGA bot

Create `DGA/config.json` with your bot token:

```json
{
  "token": "your_bot_token"
}
```

Then install dependencies and start the bot:

```bash
cd DGA
npm install
node DGA.js
```

The welcome-message handler looks for a text channel named `systeme`. Create or rename the destination channel if you want that feature to send a message.

## Security

Never commit bot tokens, API credentials, or other secrets. This repository ignores the following paths:

- `config.json`
- `.env`
- `node_modules/`

If a token is exposed, immediately reset it in the Discord Developer Portal. Keep local configuration files untracked and verify `git status` before committing.

## Troubleshooting

### The bot does not log in

- Confirm the token is correct and has not been reset.
- Confirm the configuration file is in the bot's directory and uses the expected key, `token`.
- For `wynncraft 2`, confirm `.env` contains both `DISCORD_TOKEN` and `CLIENT_ID`.
- Run `npm install` from the selected bot directory.

### Prefix commands do not respond

- Enable **Message Content Intent** in the Developer Portal.
- Confirm the bot can view the channel and send messages.
- Use the correct prefix: `!`.

### DGA does not welcome new members

- Enable **Server Members Intent**.
- Confirm the server contains a channel named `systeme`.
- Confirm the bot can view and send messages in that channel.

### Wynncraft slash commands or tracker features do not work

- Confirm the bot was invited with the `applications.commands` scope.
- Check that `CLIENT_ID` matches the Discord application ID.
- Verify the bot has the required channel permissions.
- Review the detailed [`wynncraft 2/README.md`](wynncraft%202/README.md) for tracker and API-specific notes.

## Recommended starting point

Start with `wynncraft 2` if you want the most feature-complete example. Start with `DGA` if you want the smallest example of Discord event handling and prefix commands.

## License

This project is licensed under the [MIT License](LICENSE).
