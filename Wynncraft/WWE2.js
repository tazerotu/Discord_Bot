const { Client, GatewayIntentBits } = require('discord.js');
const { token, Channel } = require('../config.json');

const prefix = '!'; // Customize the command prefix

const targetChannelId = Channel;

// Base event info (except time)
const baseEvent = {
  name: "Haywire Defender",
  suggestedLv: 3,
  requiredQuest: "-",
  coordinates: "[-441, 55, -1896]",
  region: "Maltic Plains",
  length: "Short (3m)",
  difficulty: "Medium",
  waves: 4,
  active: "No",
};

// Start time offset in minutes
let timeOffsetMinutes = 0;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function formatEventMessage(offset) {
  // Calculate time string in mm:ss format
  const totalSeconds = offset * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return `
**Name:** ${baseEvent.name}  
**Suggested Lv.:** ${baseEvent.suggestedLv}  
**Required Quest:** ${baseEvent.requiredQuest}  
**Coordinates:** ${baseEvent.coordinates}  
**Region:** ${baseEvent.region}  
**Length:** ${baseEvent.length}  
**Difficulty:** ${baseEvent.difficulty}  
**Waves:** ${baseEvent.waves}  
**Active:** ${baseEvent.active}  
**Time to start:** ${timeString}
  `;
}

client.once('ready', () => {
  console.log(`Bot is online! Logged in as ${client.user.tag}`);

  const channel = client.channels.cache.get(targetChannelId);
  if (!channel) {
    console.error("Channel not found! Check your channel ID and permissions.");
    return;
  }

  // Send initial message and keep a reference to it
  channel.send(formatEventMessage(timeOffsetMinutes)).then(message => {
    // Every 5 minutes (300000 ms), update the message
    setInterval(() => {
      timeOffsetMinutes += 5;
      message.edit(formatEventMessage(timeOffsetMinutes)).catch(console.error);
    }, 300000); // 300000 ms = 5 minutes
  }).catch(console.error);
});

client.login(token);