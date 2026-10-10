// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

const prefix = '!'; // Customize the command prefix

// Create the client with required intents, including GuildMembers to track new members
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,  // Add this intent to listen for member joins
  ]
});

client.once('ready', () => {
  console.log(`Bot is online! Logged in as ${client.user.tag}`);
});

// Listen for new member joins
client.on('guildMemberAdd', member => {
  // Choose the channel to send the welcome message to
  const welcomeChannel = member.guild.channels.cache.find(channel => channel.name === 'systeme');
  
  // If the channel exists, send a welcome message
  if (welcomeChannel) {
    welcomeChannel.send(`Welcome to the server, ${member}! Feel free to introduce yourself.`);
  }
});

client.on('messageCreate', (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    message.channel.send('Pong!');
  } else if (command === 'hello') {
    message.channel.send(`Hello, ${message.author}!`);
  }
});

client.login(token);
