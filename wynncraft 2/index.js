require('dotenv').config();
const {
  Client, GatewayIntentBits, EmbedBuilder,
  SlashCommandBuilder, REST, Routes, ActivityType
} = require('discord.js');
const axios = require('axios');

// ─── Config ───────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000;
const WYNNCRAFT_API    = 'https://api.wynncraft.com/v3';
const TIMEZONE         = 'Europe/Paris';
const UPCOMING_WINDOW  = 30 * 60 * 1000;

const UA = { headers: { 'User-Agent': 'WynnEventBot/1.0' }, timeout: 15_000 };

// ─── Hardcoded profession spots (source: Wynncraft wiki / community guides) ──
// Sorted by nodeCount desc within each profession.
// level = minimum profession level required to gather.
const PROF_SPOTS = [
  // ── Mining ──────────────────────────────────────────────────────────────────
  { prof: 'mining', material: 'Zing Ore',      level: 1,   nodeCount: 12, coords: '-280, 67, -1620'  },
  { prof: 'mining', material: 'Zomrok Ore',    level: 10,  nodeCount: 15, coords: '220, 40, -2100'   },
  { prof: 'mining', material: 'Silt Ore',      level: 20,  nodeCount: 18, coords: '490, 67, -1560'   },
  { prof: 'mining', material: 'Copper Ore',    level: 30,  nodeCount: 20, coords: '-880, 80, -5280'  },
  { prof: 'mining', material: 'Gold Ore',      level: 40,  nodeCount: 22, coords: '-1640, 55, -5470' },
  { prof: 'mining', material: 'Gylia Rock',    level: 50,  nodeCount: 24, coords: '-2060, 80, -4670' },
  { prof: 'mining', material: 'Kanderstone',   level: 60,  nodeCount: 28, coords: '-480, 110, -5050' },
  { prof: 'mining', material: 'Molten Stone',  level: 70,  nodeCount: 26, coords: '950, 55, -5160'   },
  { prof: 'mining', material: 'Voidstone',     level: 80,  nodeCount: 32, coords: '850, 15, -4800'   },
  { prof: 'mining', material: 'Chert Ore',     level: 90,  nodeCount: 30, coords: '1200, 30, -4900'  },
  { prof: 'mining', material: 'Charged Ore',   level: 100, nodeCount: 35, coords: '1400, 20, -5300'  },
  // ── Woodcutting ─────────────────────────────────────────────────────────────
  { prof: 'woodcutting', material: 'Oak Wood',    level: 1,   nodeCount: 14, coords: '-500, 67, -1620'  },
  { prof: 'woodcutting', material: 'Birch Wood',  level: 10,  nodeCount: 16, coords: '320, 67, -1700'   },
  { prof: 'woodcutting', material: 'Spruce Wood', level: 20,  nodeCount: 18, coords: '-660, 67, -2820'  },
  { prof: 'woodcutting', material: 'Acacia Wood', level: 30,  nodeCount: 22, coords: '-950, 80, -5150'  },
  { prof: 'woodcutting', material: 'Dark Wood',   level: 40,  nodeCount: 24, coords: '-1700, 70, -5300' },
  { prof: 'woodcutting', material: 'Avo Wood',    level: 50,  nodeCount: 26, coords: '-1950, 80, -4950' },
  { prof: 'woodcutting', material: 'Jungle Wood', level: 60,  nodeCount: 28, coords: '-300, 120, -5200' },
  { prof: 'woodcutting', material: 'Bamboo',      level: 70,  nodeCount: 25, coords: '700, 65, -5000'   },
  { prof: 'woodcutting', material: 'Ether Wood',  level: 80,  nodeCount: 30, coords: '1100, 50, -5100'  },
  { prof: 'woodcutting', material: 'Flerisi Wood',level: 90,  nodeCount: 28, coords: '1350, 45, -5250'  },
  { prof: 'woodcutting', material: 'Elder Wood',  level: 100, nodeCount: 35, coords: '1500, 60, -5400'  },
  // ── Farming ─────────────────────────────────────────────────────────────────
  { prof: 'farming', material: 'Wheat',     level: 1,   nodeCount: 14, coords: '-200, 67, -1700'  },
  { prof: 'farming', material: 'Barley',    level: 10,  nodeCount: 16, coords: '560, 67, -1650'   },
  { prof: 'farming', material: 'Oat',       level: 20,  nodeCount: 18, coords: '-560, 67, -2650'  },
  { prof: 'farming', material: 'Malt',      level: 30,  nodeCount: 20, coords: '-900, 80, -5200'  },
  { prof: 'farming', material: 'Hops',      level: 40,  nodeCount: 22, coords: '-1650, 65, -5400' },
  { prof: 'farming', material: 'Rye',       level: 50,  nodeCount: 24, coords: '-2000, 80, -5000' },
  { prof: 'farming', material: 'Rice',      level: 60,  nodeCount: 26, coords: '-400, 100, -5150' },
  { prof: 'farming', material: 'Corn',      level: 70,  nodeCount: 24, coords: '720, 65, -5050'   },
  { prof: 'farming', material: 'Sorghum',   level: 80,  nodeCount: 28, coords: '1000, 55, -5150'  },
  { prof: 'farming', material: 'Voidgrain', level: 90,  nodeCount: 26, coords: '1280, 50, -5250'  },
  { prof: 'farming', material: 'Voidgloom', level: 100, nodeCount: 32, coords: '1480, 55, -5450'  },
  // ── Fishing ─────────────────────────────────────────────────────────────────
  { prof: 'fishing', material: 'Gudgeon',        level: 1,   nodeCount: 10, coords: '-350, 60, -1750'  },
  { prof: 'fishing', material: 'Trout',          level: 10,  nodeCount: 12, coords: '390, 40, -2300'   },
  { prof: 'fishing', material: 'Salmon',         level: 20,  nodeCount: 14, coords: '480, 55, -1750'   },
  { prof: 'fishing', material: 'Carp',           level: 30,  nodeCount: 16, coords: '-820, 55, -5350'  },
  { prof: 'fishing', material: 'Piranha',        level: 40,  nodeCount: 18, coords: '-1580, 42, -5520' },
  { prof: 'fishing', material: 'Cod',            level: 50,  nodeCount: 20, coords: '-2200, 40, -4900' },
  { prof: 'fishing', material: 'Gylia Fish',     level: 60,  nodeCount: 24, coords: '650, 38, -5100'   },
  { prof: 'fishing', material: 'Squid',          level: 70,  nodeCount: 22, coords: '800, 50, -5200'   },
  { prof: 'fishing', material: 'Glow Squid',     level: 80,  nodeCount: 26, coords: '1050, 42, -5100'  },
  { prof: 'fishing', material: 'Deep Sea Fish',  level: 90,  nodeCount: 24, coords: '1300, 38, -5300'  },
  { prof: 'fishing', material: 'Voidfish',       level: 100, nodeCount: 30, coords: '1450, 35, -5500'  },
];

const PROF_EMOJI = { mining: '⛏️', woodcutting: '🪓', fishing: '🎣', farming: '🌾' };
const REGION_PREFIXES = { WC: 'US', US: 'US', EU: 'EU', AS: 'AS' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRegion(name) {
  if (!name) return 'OTHER';
  return REGION_PREFIXES[name.replace(/\d+$/, '').toUpperCase()] ?? 'OTHER';
}
function regionEmoji(r) {
  return { US: '🇺🇸', EU: '🇪🇺', AS: '🇯🇵', OTHER: '🌐' }[r] ?? '🌐';
}
function parisTime(d = new Date()) {
  return d.toLocaleString('fr-FR', {
    timeZone: TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
function parisTimeShort(d = new Date()) {
  return d.toLocaleString('fr-FR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });
}
function classifyEvent(evt) {
  if (!evt.schedule) return { status: 'active', startsAt: null };
  const startsAt = new Date(evt.schedule);
  const diff = startsAt.getTime() - Date.now();
  if (diff <= 0) return { status: 'active', startsAt };
  if (diff <= UPCOMING_WINDOW) return { status: 'soon', startsAt };
  return { status: 'upcoming', startsAt };
}
function diffEmoji(d) { return { EASY: '🟢', MEDIUM: '🟡', HARD: '🔴', EXTREME: '💀' }[d] ?? '⚔️'; }
function chunkField(embed, title, lines, inline = false) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? cur + '\n' + line : line;
    if (next.length > 1020) { chunks.push(cur); cur = line; }
    else cur = next;
  }
  if (cur) chunks.push(cur);
  chunks.forEach((chunk, i) => embed.addFields({
    name: i === 0 ? title : `${title} (cont.)`,
    value: chunk || '—',
    inline,
  }));
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function fetchAllEvents() {
  const r = await axios.get(`${WYNNCRAFT_API}/map/world-events`, UA);
  return Array.isArray(r.data) ? r.data : [];
}
async function fetchOnlinePlayers() {
  const r = await axios.get(`${WYNNCRAFT_API}/player`, UA);
  return r.data;
}

// ─── State ────────────────────────────────────────────────────────────────────
let cachedEvents = [];
let cachedServers = {};
let lastUpdated  = null;
let trackerChannelId = process.env.TRACKER_CHANNEL_ID || null;
let trackerMessageId = null;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function buildServerMap(playerData) {
  const servers = {};
  for (const serverName of Object.values(playerData?.players ?? {})) {
    servers[serverName] ??= { region: getRegion(serverName), playerCount: 0 };
    servers[serverName].playerCount++;
  }
  return servers;
}

// ─── Profspots query ──────────────────────────────────────────────────────────
// Returns spots the player can access: level <= playerLevel, sorted by nodeCount desc.
// If playerLevel is null, returns all spots.
function querySpots(prof, playerLevel) {
  return PROF_SPOTS
    .filter(s => {
      if (prof && s.prof !== prof) return false;
      if (playerLevel !== null && s.level > playerLevel) return false;
      return true;
    })
    .sort((a, b) => b.nodeCount - a.nodeCount);
}

// ─── Embeds ───────────────────────────────────────────────────────────────────
function buildServerEventsEmbed(servers, events, filterRegion = null) {
  const regions = filterRegion ? [filterRegion] : ['US', 'EU', 'AS', 'OTHER'];
  const activeEvents = events
    .filter(e => classifyEvent(e).status !== 'upcoming')
    .sort((a, b) => (classifyEvent(a).startsAt?.getTime() ?? 0) - (classifyEvent(b).startsAt?.getTime() ?? 0));

  const totalPlayers = Object.values(servers).reduce((s, v) => s + v.playerCount, 0);
  const embed = new EmbedBuilder()
    .setTitle(filterRegion
      ? `${regionEmoji(filterRegion)}  ${filterRegion} Servers — World Events`
      : '🌍  Wynncraft — Servers & World Events')
    .setColor(0x2ecc71)
    .setDescription(
      `**${totalPlayers}** players online  •  **${activeEvents.length}** events active/soon\n` +
      `🕐 ${parisTime(lastUpdated ?? new Date())} Paris`
    )
    .setFooter({ text: 'Refreshes every 60 s  •  /events [region]  •  /search  •  /profspots' });

  if (activeEvents.length) {
    chunkField(embed, '⚔️  Active & Starting Soon', activeEvents.map(e => {
      const { status, startsAt } = classifyEvent(e);
      const s = status === 'active' ? '🟢 Active' : `⏰ ${parisTimeShort(startsAt)}`;
      return `${diffEmoji(e.difficulty)} **${e.name}** · Lv.${e.level} · ${s}`;
    }));
  } else {
    embed.addFields({ name: '⚔️  Active Events', value: '*No events active right now*' });
  }

  for (const region of regions) {
    const list = Object.entries(servers)
      .filter(([, i]) => i.region === region)
      .sort(([, a], [, b]) => b.playerCount - a.playerCount);
    if (!list.length) continue;
    chunkField(embed, `${regionEmoji(region)} ${region} Servers`,
      list.map(([name, info]) => `\`${name.padEnd(4)}\`  👥 ${String(info.playerCount).padStart(3)}`), true);
  }

  const upcoming = events
    .filter(e => classifyEvent(e).status === 'upcoming')
    .sort((a, b) => new Date(a.schedule) - new Date(b.schedule))
    .slice(0, 6);
  if (upcoming.length)
    chunkField(embed, '🕐  Upcoming (next 6)',
      upcoming.map(e => `${diffEmoji(e.difficulty)} **${e.name}** · ${parisTimeShort(new Date(e.schedule))}`));

  return embed;
}

function buildProfSpotsEmbed(prof, playerLevel) {
  const spots   = querySpots(prof, playerLevel);
  const profLabel  = prof ? prof.charAt(0).toUpperCase() + prof.slice(1) : 'All Professions';
  const levelLabel = playerLevel !== null ? `Lv.≤${playerLevel}` : 'All Levels';

  const embed = new EmbedBuilder()
    .setTitle(`${prof ? PROF_EMOJI[prof] : '⛏️🪓🎣🌾'}  Best Gathering Spots — ${profLabel} · ${levelLabel}`)
    .setColor(0xe67e22)
    .setFooter({ text: 'Sorted by node count (most nodes = best XP/hr)  •  Coords: X, Y, Z' });

  if (!spots.length) {
    embed.setDescription(`No spots found for **${profLabel}** at **${levelLabel}**.`);
    return embed;
  }

  // Group by profession for display
  const byProf = {};
  for (const s of spots) (byProf[s.prof] ??= []).push(s);

  for (const [p, pspots] of Object.entries(byProf)) {
    const lines = pspots.map(s => {
      const bar = '█'.repeat(Math.min(10, Math.ceil(s.nodeCount / 4))) +
                  '░'.repeat(Math.max(0, 10 - Math.ceil(s.nodeCount / 4)));
      return `${PROF_EMOJI[p]} **${s.material}** · Lv.**${s.level}** · **${s.nodeCount}** nodes  \`${bar}\`\n  ┗ \`${s.coords}\``;
    });
    chunkField(embed, `${PROF_EMOJI[p]}  ${p.charAt(0).toUpperCase() + p.slice(1)}`, lines);
  }

  return embed;
}

// ─── Polling ──────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const [eventsRes, playersRes] = await Promise.allSettled([fetchAllEvents(), fetchOnlinePlayers()]);
    if (eventsRes.status  === 'fulfilled') cachedEvents  = eventsRes.value;
    if (playersRes.status === 'fulfilled') cachedServers = buildServerMap(playersRes.value);
    else console.error('[Poll] /player failed:', playersRes.reason?.message);
    lastUpdated = new Date();

    const active = cachedEvents.filter(e => classifyEvent(e).status !== 'upcoming').length;
    const total  = Object.values(cachedServers).reduce((s, v) => s + v.playerCount, 0);
    console.log(`[${parisTime()}] ${cachedEvents.length} events (${active} active/soon) | ${Object.keys(cachedServers).length} servers | ${total} players`);

    if (trackerChannelId) {
      const channel = client.channels.cache.get(trackerChannelId);
      if (channel) {
        const embed = buildServerEventsEmbed(cachedServers, cachedEvents);
        try {
          if (trackerMessageId) {
            const msg = await channel.messages.fetch(trackerMessageId);
            await msg.edit({ embeds: [embed] });
          } else {
            const msg = await channel.send({ embeds: [embed] });
            trackerMessageId = msg.id;
            await msg.pin().catch(() => {});
          }
        } catch {
          trackerMessageId = null;
          const msg = await channel.send({ embeds: [embed] });
          trackerMessageId = msg.id;
        }
      }
    }

    client.user?.setActivity(`${active} active events`, { type: ActivityType.Watching });
  } catch (err) {
    console.error(`[${parisTime()}] Poll error:`, err.message);
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('events')
    .setDescription('Show servers with active world events, optionally filtered by region')
    .addStringOption(o =>
      o.setName('region').setDescription('Filter to a region (default: all)').setRequired(false)
        .addChoices({ name: '🇺🇸 US', value: 'US' }, { name: '🇪🇺 EU', value: 'EU' }, { name: '🇯🇵 AS', value: 'AS' })
    ),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a world event by name')
    .addStringOption(o => o.setName('name').setDescription('Event name (partial match)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('profspots')
    .setDescription('Best gathering spots by node density — from live API data')
    .addStringOption(o =>
      o.setName('profession').setDescription('Profession (default: all)').setRequired(false)
        .addChoices(
          { name: '⛏️ Mining',      value: 'mining' },
          { name: '🪓 Woodcutting', value: 'woodcutting' },
          { name: '🎣 Fishing',     value: 'fishing' },
          { name: '🌾 Farming',     value: 'farming' },
        )
    )
    .addIntegerOption(o =>
      o.setName('level').setDescription('Your profession level (shows nodes you can gather)').setRequired(false)
        .setMinValue(1).setMaxValue(132)
    ),

  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Info for a specific server')
    .addStringOption(o => o.setName('name').setDescription('Server name (e.g. WC1, EU3)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('settracker')
    .setDescription('Pin a live-updating board in this channel (Manage Channels required)'),

  new SlashCommandBuilder()
    .setName('stoptracker')
    .setDescription('Stop the live tracker (Manage Channels required)'),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log('Registering slash commands…');
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('Commands registered!');
}

// ─── Interactions ──────────────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  if (commandName === 'events') {
    await interaction.deferReply();
    if (!cachedEvents.length) await poll();
    const region = interaction.options.getString('region') ?? null;
    await interaction.editReply({ embeds: [buildServerEventsEmbed(cachedServers, cachedEvents, region)] });
    return;
  }

  if (commandName === 'search') {
    await interaction.deferReply();
    const query   = interaction.options.getString('name').toLowerCase();
    const matches = cachedEvents.filter(e => e.name.toLowerCase().includes(query));
    if (!matches.length) {
      await interaction.editReply({ embeds: [
        new EmbedBuilder().setTitle(`🔍 "${query}"`).setDescription('No events matched.').setColor(0xe74c3c)
          .setFooter({ text: parisTime() + ' Paris' }),
      ]});
      return;
    }
    const sorted = [...matches].sort((a, b) => {
      const o = { active: 0, soon: 1, upcoming: 2 };
      return (o[classifyEvent(a).status] ?? 3) - (o[classifyEvent(b).status] ?? 3);
    });
    const lines = sorted.map(e => {
      const { status, startsAt } = classifyEvent(e);
      const s = status === 'active' ? '🟢 Active' : status === 'soon' ? `⏰ ${parisTimeShort(startsAt)}` : `🕐 ${parisTimeShort(startsAt)}`;
      return `${diffEmoji(e.difficulty)} **${e.name}** · Lv.${e.level} · ${e.length ?? ''} · ${s}`;
    });
    const embed = new EmbedBuilder()
      .setTitle(`🔍 "${query}" — ${matches.length} result(s)`)
      .setDescription(lines.join('\n'))
      .setColor(0x3498db)
      .setFooter({ text: parisTime() + ' Paris' });
    if (matches.length === 1) {
      const e = matches[0];
      if (e.lore) embed.addFields({ name: '📖 Lore', value: e.lore });
      if (e.requirements?.length)
        embed.addFields({ name: '📋 Requirements', value: e.requirements.map(r => `${r.type}: ${r.value}`).join(', ') });
      const rewards = e.rewardPerLevel?.['1'];
      if (rewards?.length) embed.addFields({ name: '🏆 Rewards', value: rewards.join('\n') });
    }
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (commandName === 'profspots') {
    await interaction.deferReply();
    const prof       = interaction.options.getString('profession') ?? null;
    const playerLevel = interaction.options.getInteger('level') ?? null;
    await interaction.editReply({ embeds: [buildProfSpotsEmbed(prof, playerLevel)] });
    return;
  }

  if (commandName === 'server') {
    await interaction.deferReply();
    const name = interaction.options.getString('name').toUpperCase();
    const info = cachedServers[name];
    if (!info) {
      await interaction.editReply({ embeds: [
        new EmbedBuilder().setTitle(`Server: ${name}`).setDescription('Not found or offline.').setColor(0xe74c3c),
      ]});
      return;
    }
    await interaction.editReply({ embeds: [
      new EmbedBuilder()
        .setTitle(`${regionEmoji(info.region)}  Server ${name}`)
        .addFields(
          { name: '👥 Players', value: `${info.playerCount}`, inline: true },
          { name: '🌍 Region',  value: info.region,           inline: true },
        )
        .setColor(0x9b59b6)
        .setFooter({ text: parisTime() + ' Paris' }).setTimestamp(),
    ]});
    return;
  }

  if (commandName === 'settracker') {
    if (!interaction.member.permissions.has('ManageChannels')) {
      await interaction.reply({ content: '❌ Requires **Manage Channels**.', ephemeral: true });
      return;
    }
    trackerChannelId = interaction.channelId;
    trackerMessageId = null;
    await interaction.reply({ content: '✅ Live tracker activated — updates every 60 s.', ephemeral: true });
    poll();
    return;
  }

  if (commandName === 'stoptracker') {
    if (!interaction.member.permissions.has('ManageChannels')) {
      await interaction.reply({ content: '❌ Requires **Manage Channels**.', ephemeral: true });
      return;
    }
    trackerChannelId = null;
    trackerMessageId = null;
    await interaction.reply({ content: '✅ Tracker stopped.', ephemeral: true });
    return;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
});

client.login(process.env.DISCORD_TOKEN);