// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('../config.json');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, c => {
	const botName = c.user.username; // Bot's display name
	console.log(`🤖 Hello! I am ${botName} — Ready and logged in as ${c.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);