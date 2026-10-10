const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const fetch = require('node-fetch');
const { token } = require('./config.json');

// ─── Config ────────────────────────────────────────────────────────────────
const PREFIX = '!';
const WIKI_API = 'https://wiki.warframe.com/api.php';
const WFM_API  = 'https://api.warframe.market/v2';

// WFM — fetch the page first to get the CSRF token + session cookie
const WFM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
let wfmSessionCookies = '';
let wfmCsrfToken = '';

async function ensureWfmSession() {
  if (wfmCsrfToken) return;
  try {
    const res = await fetch('https://warframe.market/', {
      headers: {
        'User-Agent':      WFM_UA,
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    // Grab session cookies
    const raw = res.headers.raw()['set-cookie'] || [];
    wfmSessionCookies = raw.map(c => c.split(';')[0]).join('; ');
    // Extract CSRF token from HTML meta tag
    const html = await res.text();
    const match = html.match(/meta-csrf-token['":\s]+([a-f0-9]{80,})/i)
                || html.match(/csrf.token['":\s]+([a-f0-9]{80,})/i)
                || html.match(/content="(##?[a-f0-9]{60,})"/i);
    if (match) {
      wfmCsrfToken = match[1].replace(/^##?/, '');
      console.log('🍪  WFM session + CSRF token acquired');
    } else {
      // Try the meta tag format: ##TOKEN
      const m2 = html.match(/##([a-f0-9]{60,})/);
      wfmCsrfToken = m2 ? m2[1] : 'none';
      console.log('🍪  WFM session established (CSRF:', wfmCsrfToken.slice(0,12) + '...)');
    }
  } catch (e) {
    console.warn('⚠️  WFM session fetch failed:', e.message);
  }
}

function wfmHeaders() {
  return {
    'Accept':          'application/json',
    'Accept-Language': 'en',
    'language':        'en',
    'platform':        'pc',
    'User-Agent':      WFM_UA,
    'Referer':         'https://warframe.market/',
    'Origin':          'https://warframe.market',
    'Cookie':          wfmSessionCookies,
    'X-CSRFToken':     wfmCsrfToken,
  };
}


const WIKI_HEADERS = {
  'User-Agent': 'WarframeRelicBot/1.0 (Discord bot; contact via Discord)',
  'Accept':     'application/json',
};

const PRICE_SAMPLE          = 10;
const PRICE_DELTA_THRESHOLD = 20;

const DROP_CHANCES = {
  Common:   { Intact: 25.33, Exceptional: 23.33, Flawless: 20.00, Radiant: 16.67 },
  Uncommon: { Intact: 11.00, Exceptional: 13.00, Flawless: 17.00, Radiant: 20.00 },
  Rare:     { Intact:  2.00, Exceptional:  4.00, Flawless:  6.00, Radiant: 10.00 },
};

const RARITY_CONFIG = {
  Common:   { emoji: '🔵', label: 'Common'   },
  Uncommon: { emoji: '🟡', label: 'Uncommon' },
  Rare:     { emoji: '🔴', label: 'Rare'     },
};

const TIER_COLORS = {
  Lith:    0xc8aa6e,
  Meso:    0x8a9bb0,
  Neo:     0xd4a843,
  Axi:     0xa0522d,
  Requiem: 0x9b59b6,
};

// ─── Wiki CSRF token ──────────────────────────────────────────────────────
// The scribunto-console action requires a CSRF token from the MediaWiki API.
// We cache it with the session cookie for 30 minutes.
let wikiToken   = null;
let wikiCookies = '';
let wikiTokenAt = 0;
const WIKI_TOKEN_TTL = 30 * 60 * 1000;

async function getWikiToken() {
  if (wikiToken && Date.now() - wikiTokenAt < WIKI_TOKEN_TTL) return wikiToken;

  const res = await fetch(
    `${WIKI_API}?action=query&meta=tokens&type=csrf&format=json`,
    { headers: WIKI_HEADERS }
  );
  if (!res.ok) throw new Error(`Wiki token fetch HTTP ${res.status}`);

  // Capture Set-Cookie for session continuity
  const setCookie = res.headers.raw()['set-cookie'];
  if (setCookie) wikiCookies = setCookie.map(c => c.split(';')[0]).join('; ');

  const data = await res.json();
  wikiToken   = data?.query?.tokens?.csrftoken;
  wikiTokenAt = Date.now();
  if (!wikiToken) throw new Error('Could not retrieve wiki CSRF token');
  console.log('🔑  Wiki CSRF token acquired');
  return wikiToken;
}

// ─── Wiki Lua runner ──────────────────────────────────────────────────────
async function runLua(luaCode) {
  const csrfToken = await getWikiToken();

  const params = new URLSearchParams({
    action:  'scribunto-console',
    format:  'json',
    title:   'Module:Void/data',
    content: '',
    question: luaCode,
    token:   csrfToken,
    clear:   '1',
    utf8:    '1',
  });

  const res = await fetch(`${WIKI_API}`, {
    method:  'POST',
    headers: { ...WIKI_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: wikiCookies },
    body:    params.toString(),
  });

  if (!res.ok) throw new Error(`Wiki API HTTP ${res.status}`);
  const d = await res.json();

  if (d.error) {
    // Token expired — clear and retry once
    if (d.error.code === 'badtoken' || d.error.code === 'missingparam') {
      wikiToken = null;
      return runLua(luaCode);
    }
    throw new Error(`Wiki error: ${d.error.code} — ${d.error.info}`);
  }

  if (d.print)  return JSON.parse(d.print.trim());
  if (d.return) return JSON.parse(d.return.trim());

  console.error('Wiki unexpected response:', JSON.stringify(d).slice(0, 400));
  throw new Error('Empty wiki API response');
}

// ─── WFM slug builder ────────────────────────────────────────────────────
// WFM slugs are always: lowercase, spaces→underscores, special chars removed
// e.g. "Nova Prime Systems Blueprint" → "nova_prime_systems_blueprint"
// No item list needed — build directly from the display name.
function buildSlug(displayName) {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');
}

async function resolveSlug(displayName) {
  return buildSlug(displayName);
}

async function fetchWfmPrices(slug) {
  // v2 /orders/top returns pre-sorted top 5 sell + top 5 buy — no filtering needed
  const url = `${WFM_API}/orders/item/${slug}/top?platform=pc`;
  let res;
  try {
    res = await fetch(url, { headers: wfmHeaders() });
  } catch (e) {
    console.error(`[WFM] fetch error for ${slug}:`, e.message);
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[WFM] ${slug} → HTTP ${res.status}: ${body.slice(0, 100)}`);
    return null;
  }
  const data = await res.json();
  // v2 shape: { payload: { sell: [...], buy: [...] } }
  const sell = data.payload?.sell ?? data.data?.sell ?? [];
  // console.log(`[WFM] ${slug} → ${sell.length} sell orders`);
  const prices = sell
    .map(o => o.platinum ?? o.price)
    .filter(p => typeof p === 'number')
    .sort((a, b) => a - b)
    .slice(0, PRICE_SAMPLE);
  if (!prices.length) return null;
  const min = prices[0], max = prices[prices.length - 1];
  return { prices, min, max, delta: max - min, avg: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) };
}

function formatPrice(info) {
  if (!info) return '*no listings*';
  if (info.delta <= PRICE_DELTA_THRESHOLD)
    return `~**${info.avg}**p  *(avg of ${info.prices.length}, Δ${info.delta})*`;
  return info.prices.join(' · ') + `p  *(spread > ${PRICE_DELTA_THRESHOLD}p)*`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Input normalisation ──────────────────────────────────────────────────
function normaliseName(input) {
  return input.trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
    .split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// RELIC COMMAND
// ═══════════════════════════════════════════════════════════════════════════

async function fetchRelicDrops(relicName) {
  return runLua(`
local d = require('Module:Void/data')
local j = require('Module:JSON')
local r = d.RelicData["${relicName}"]
if r == nil then print(j.stringify({error="not_found"})) else print(j.stringify(r)) end`);
}

async function fetchRelicLocations(relicName) {
  return runLua(`
local D = require('Module:DropTables/data')
local j = require('Module:JSON')
local res = {}
for k, m in pairs(D.Missions) do
  if m.Rewards ~= nil and m._IgnoreEntry ~= true then
    for rot, tbl in pairs(m.Rewards) do
      for _, drop in ipairs(tbl) do
        if drop[1] == "${relicName}" and drop[2] == "Relic" then
          table.insert(res,{Name=m.Name or k,Planet=m.Tier or "",Rot=rot,Chance=drop[3] or 0})
        end
      end
    end
  end
end
print(j.stringify(res))`);
}

async function fetchAllRelicPrices(drops) {
  const map = new Map();
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    try {
      if (d.Item?.toLowerCase() === 'forma') { map.set(i, null); continue; }
      const slug = await resolveSlug(`${d.Item} ${d.Part}`);
      map.set(i, slug ? await fetchWfmPrices(slug) : null);
    } catch { map.set(i, null); }
    if (i < drops.length - 1) await sleep(360);
  }
  return map;
}

function buildRelicEmbed(relicName, relicData, locations, priceMap) {
  const tier      = relicData.Tier || relicName.split(' ')[0];
  const isVaulted = !!relicData.Vaulted;
  const embed = new EmbedBuilder()
    .setColor(TIER_COLORS[tier] ?? 0x5865f2)
    .setTitle(`${tier === 'Requiem' ? '☠️' : '🔮'} ${relicName} Relic`)
    .setURL(`https://wiki.warframe.com/w/${relicName.replace(/ /g, '_')}`)
    .setThumbnail(getTierThumb(tier))
    .setFooter({ text: 'wiki.warframe.com · warframe.market  |  sell orders (in-game)  |  Intact→Radiant' });

  const badges = [];
  if (isVaulted)        badges.push('🔒 **VAULTED**');
  if (relicData.IsBaro) badges.push("👁️ **Baro Ki'Teer**");
  if (badges.length) embed.setDescription(badges.join('  '));

  const grouped = { Common: [], Uncommon: [], Rare: [] };
  (relicData.Drops || []).forEach((d, i) => { if (grouped[d.Rarity]) grouped[d.Rarity].push({ ...d, _i: i }); });

  for (const rarity of ['Common', 'Uncommon', 'Rare']) {
    const items = grouped[rarity];
    if (!items.length) continue;
    const cfg = RARITY_CONFIG[rarity], ch = DROP_CHANCES[rarity];
    const lines = items.map(d => {
      const name  = d.ItemCount > 1 ? `${d.ItemCount}x ${d.Item} ${d.Part}` : `${d.Item} ${d.Part}`;
      const price = priceMap ? formatPrice(priceMap.get(d._i)) : '…';
      return `\`${ch.Intact}%\`→\`${ch.Radiant}%\`  **${name}**\n> 💰 ${price}`;
    });
    embed.addFields({ name: `${cfg.emoji} ${cfg.label}`, value: lines.join('\n'), inline: false });
  }

  if (!isVaulted && locations?.length) {
    const byM = {};
    for (const l of locations) {
      const k = `${l.Planet ? l.Planet + ' — ' : ''}${l.Name}`;
      (byM[k] = byM[k] || []).push(l);
    }
    const lines = Object.keys(byM).sort().slice(0, 10).map(k => {
      const rots = byM[k].sort((a, b) => a.Rot.localeCompare(b.Rot))
        .map(r => `**Rot ${r.Rot}** ${r.Chance}%`).join('  ·  ');
      return `**${k}** — ${rots}`;
    });
    const extra = locations.length > 10 ? `\n*…and ${locations.length - 10} more*` : '';
    embed.addFields({ name: '📍 Drop Locations', value: lines.join('\n') + extra, inline: false });
  } else if (isVaulted) {
    embed.addFields({ name: '📍 Drop Locations', value: '> Vaulted — trade with other players.', inline: false });
  } else {
    embed.addFields({ name: '📍 Drop Locations', value: '*No mission data found.*', inline: false });
  }
  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM COMMAND
// ═══════════════════════════════════════════════════════════════════════════

async function fetchPrimeItemData(itemName) {
  return runLua(`
local VD = require('Module:Void/data')
local j  = require('Module:JSON')
local pd = VD.PrimeData["${itemName}"]
if pd == nil then print(j.stringify({error="not_found"})) return end
local parts = {}
for partName, partData in pairs(pd.Parts) do
  local relics = {}
  for relicName, rarity in pairs(partData.Drops) do
    table.insert(relics, {relic=relicName, rarity=rarity})
  end
  table.insert(parts, {part=partName, relics=relics, ducats=partData.DucatValue or 0})
end
print(j.stringify({parts=parts, vaulted=pd.Vaulted or false, type="prime"}))`);
}

async function fetchRegularItemDrops(itemName) {
  return runLua(`
local D = require('Module:DropTables/data')
local j = require('Module:JSON')
local results = {}
local target = "${itemName}"
for key, mission in pairs(D.Missions) do
  if mission.Rewards ~= nil and mission._IgnoreEntry ~= true then
    for rot, tbl in pairs(mission.Rewards) do
      for _, drop in ipairs(tbl) do
        if drop[1] == target then
          table.insert(results, {Name=mission.Name or key,Planet=mission.Tier or "",MType=mission.Link or "",Rot=rot,Chance=drop[3] or 0,IType=drop[2] or ""})
        end
      end
    end
  end
end
print(j.stringify({drops=results, type="regular"}))`);
}

async function fetchEnemyDrops(itemName) {
  return runLua(`
local D = require('Module:DropTables/data')
local j = require('Module:JSON')
local results = {}
local target = "${itemName}"
if D.Enemies ~= nil then
  for eName, enemy in pairs(D.Enemies) do
    if enemy.Drops ~= nil then
      for _, drop in ipairs(enemy.Drops) do
        if drop[1] == target then
          table.insert(results, {Enemy=eName, Chance=drop[3] or 0, IType=drop[2] or ""})
        end
      end
    end
  end
end
print(j.stringify(results))`);
}

async function fetchRelicLocationsBatch(relicNames) {
  const list = relicNames.map(r => `"${r}"`).join(',');
  return runLua(`
local D = require('Module:DropTables/data')
local j = require('Module:JSON')
local targets = {${list}}
local tset = {}
for _, r in ipairs(targets) do tset[r] = true end
local results = {}
for key, mission in pairs(D.Missions) do
  if mission.Rewards ~= nil and mission._IgnoreEntry ~= true then
    for rot, tbl in pairs(mission.Rewards) do
      for _, drop in ipairs(tbl) do
        if drop[2] == "Relic" and tset[drop[1]] then
          if results[drop[1]] == nil then results[drop[1]] = {} end
          table.insert(results[drop[1]], {Name=mission.Name or key,Planet=mission.Tier or "",Rot=rot,Chance=drop[3] or 0})
        end
      end
    end
  end
end
print(j.stringify(results))`);
}

async function fetchPrimeSetPrices(itemName, parts) {
  const map   = new Map();
  const tasks = [{ key: `${itemName} Set`, display: `${itemName} Set` }];
  for (const p of parts) {
    if (p.part?.toLowerCase() !== 'forma')
      tasks.push({ key: `${itemName} ${p.part}`, display: `${itemName} ${p.part}` });
  }
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    try {
      const slug = await resolveSlug(t.display);
      map.set(t.key, slug ? await fetchWfmPrices(slug) : null);
    } catch { map.set(t.key, null); }
    if (i < tasks.length - 1) await sleep(360);
  }
  return map;
}

async function fetchRegularItemPrices(itemName) {
  const map = new Map();
  for (const name of [itemName, `${itemName} Blueprint`, `${itemName} Set`]) {
    try {
      const slug = await resolveSlug(name);
      if (slug) map.set(name, await fetchWfmPrices(slug));
    } catch {}
    await sleep(360);
  }
  return map;
}

function getTierThumb(tier) {
  const map = { Lith:'LithRelicIntact', Meso:'MesoRelicIntact', Neo:'NeoRelicIntact', Axi:'AxiRelicIntact', Requiem:'RequiemRelicIntact' };
  return `https://wiki.warframe.com/images/${map[tier] || 'MesoRelicIntact'}.png`;
}

function buildPrimeEmbed(itemName, primeData, relicLocationMap, priceMap) {
  const isVaulted = primeData.vaulted === true;
  const embed = new EmbedBuilder()
    .setColor(isVaulted ? 0x888888 : 0xd4a843)
    .setTitle(`✨ ${itemName}`)
    .setURL(`https://wiki.warframe.com/w/${itemName.replace(/ /g, '_')}`)
    .setFooter({ text: 'wiki.warframe.com · warframe.market  |  sell orders (in-game)' });

  if (isVaulted) embed.setDescription('🔒 **VAULTED**');

  const setInfo = priceMap?.get(`${itemName} Set`);
  if (setInfo !== undefined) embed.addFields({ name: '💰 Set Price', value: formatPrice(setInfo), inline: false });

  const RARITY_ORDER = { Common: 0, Uncommon: 1, Rare: 2 };
  const parts = [...primeData.parts].sort((a, b) => {
    const ra = a.relics[0]?.rarity ?? 'Common';
    const rb = b.relics[0]?.rarity ?? 'Common';
    return (RARITY_ORDER[ra] ?? 0) - (RARITY_ORDER[rb] ?? 0);
  });

  for (const p of parts) {
    const rarities   = [...new Set(p.relics.map(r => r.rarity))];
    const mainRarity = rarities.includes('Rare') ? 'Rare' : rarities.includes('Uncommon') ? 'Uncommon' : 'Common';
    const cfg        = RARITY_CONFIG[mainRarity];
    const partKey    = `${itemName} ${p.part}`;
    const price      = priceMap ? formatPrice(priceMap.get(partKey)) : '…';

    const relicLines = p.relics.map(r => {
      const rc      = RARITY_CONFIG[r.rarity];
      const ch2     = DROP_CHANCES[r.rarity];
      const locList = relicLocationMap?.[r.relic];
      const hasLocs = locList?.length > 0;
      const locSummary = hasLocs
        ? locList.slice(0, 3).map(l => `${l.Planet ? l.Planet + '/' : ''}${l.Name} **Rot ${l.Rot}** ${l.Chance}%`).join(', ')
          + (locList.length > 3 ? ` *(+${locList.length - 3} more)*` : '')
        : '🔒 vaulted';
      return `${rc.emoji} **${r.relic}** \`${ch2.Intact}%\`→\`${ch2.Radiant}%\`\n> ${locSummary}`;
    });

    embed.addFields({
      name:  `${cfg.emoji} ${p.part}  —  💰 ${price}  |  🪙 ${p.ducats} ducats`,
      value: relicLines.join('\n') || '*No relics found*',
      inline: false,
    });
  }
  return embed;
}

function buildRegularEmbed(itemName, dropData, enemyDrops, priceMap) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🔧 ${itemName}`)
    .setURL(`https://wiki.warframe.com/w/${itemName.replace(/ /g, '_')}`)
    .setFooter({ text: 'wiki.warframe.com · warframe.market  |  sell orders (in-game)' });

  const priceLines = [];
  for (const [key, info] of (priceMap || new Map())) {
    if (info) priceLines.push(`**${key}**: ${formatPrice(info)}`);
  }
  if (priceLines.length) embed.addFields({ name: '💰 Market Prices', value: priceLines.join('\n'), inline: false });

  const drops = dropData?.drops || [];
  if (drops.length) {
    const byM = {};
    for (const d of drops) {
      const k = `${d.Planet ? d.Planet + ' — ' : ''}${d.Name}`;
      (byM[k] = byM[k] || []).push(d);
    }
    const lines = Object.keys(byM).sort().slice(0, 12).map(k => {
      const rots = byM[k].sort((a, b) => a.Rot.localeCompare(b.Rot))
        .map(r => `**Rot ${r.Rot}** ${r.Chance}%`).join('  ·  ');
      return `**${k}** — ${rots}`;
    });
    embed.addFields({ name: '📍 Mission Drop Locations', value: lines.join('\n') + (drops.length > 12 ? `\n*…and ${drops.length - 12} more*` : ''), inline: false });
  }

  if (enemyDrops?.length) {
    embed.addFields({
      name:  '👾 Enemy Drops',
      value: enemyDrops.slice(0, 10).map(e => `**${e.Enemy}** — ${e.Chance}%`).join('\n'),
      inline: false,
    });
  }

  if (!drops.length && !enemyDrops?.length && !priceLines.length)
    embed.setDescription('*No drop or market data found.*');

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════
// Discord bot
// ═══════════════════════════════════════════════════════════════════════════

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('clientReady', async () => {
  console.log(`✅  ${client.user.tag} ready`);
  client.user.setActivity('!relic | !item | !wfhelp', { type: ActivityType.Watching });

  // Pre-warm both APIs
  getWikiToken().catch(e => console.warn('⚠️  Wiki token pre-load:', e.message));
  ensureWfmSession().catch(e => console.warn('⚠️  WFM session failed:', e.message));
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;
  const args    = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ── !relic ─────────────────────────────────────────────────────────────
  if (command === 'relic') {
    if (!args.length) return msg.reply('Usage: `!relic <name>` — e.g. `!relic meso b3`');
    const relicName = normaliseName(args.join(' '));
    const loadMsg   = await msg.reply(`🔍 Looking up **${relicName}**…`);
    try {
      const [relicData, locations] = await Promise.all([
        fetchRelicDrops(relicName),
        fetchRelicLocations(relicName).catch(() => []),
      ]);
      if (relicData.error === 'not_found')
        return loadMsg.edit(`❌ No relic found for \`${relicName}\`. Example: \`!relic meso b3\``);

      const preview = buildRelicEmbed(relicName, relicData, locations, null);
      preview.setDescription(((preview.data.description ?? '') + '\n*⏳ Fetching prices…*').trim());
      await loadMsg.edit({ content: '', embeds: [preview] });

      const priceMap = await fetchAllRelicPrices(relicData.Drops || []);
      await loadMsg.edit({ content: '', embeds: [buildRelicEmbed(relicName, relicData, locations, priceMap)] });
    } catch (err) {
      console.error(err);
      await loadMsg.edit(`⚠️ Error fetching **${relicName}**: ${err.message}`);
    }
  }

  // ── !item ──────────────────────────────────────────────────────────────
  if (command === 'item') {
    if (!args.length) return msg.reply('Usage: `!item <name>` — e.g. `!item nova prime`, `!item ash`');
    const itemName = normaliseName(args.join(' '));
    const loadMsg  = await msg.reply(`🔍 Looking up **${itemName}**…`);
    try {
      const primeData = await fetchPrimeItemData(itemName);

      if (primeData.error !== 'not_found' && primeData.parts?.length) {
        await loadMsg.edit({ content: `✨ **${itemName}** — fetching relic locations…`, embeds: [] });
        const allRelics       = [...new Set(primeData.parts.flatMap(p => p.relics.map(r => r.relic)))];
        const relicLocationMap = allRelics.length ? await fetchRelicLocationsBatch(allRelics).catch(() => ({})) : {};

        const preview = buildPrimeEmbed(itemName, primeData, relicLocationMap, null);
        preview.addFields({ name: '⏳ Fetching market prices…', value: '\u200b', inline: false });
        await loadMsg.edit({ content: '', embeds: [preview] });

        const priceMap = await fetchPrimeSetPrices(itemName, primeData.parts);
        await loadMsg.edit({ content: '', embeds: [buildPrimeEmbed(itemName, primeData, relicLocationMap, priceMap)] });

      } else {
        await loadMsg.edit({ content: `🔧 **${itemName}** — searching drop tables…`, embeds: [] });
        const [dropData, enemyDrops] = await Promise.all([
          fetchRegularItemDrops(itemName),
          fetchEnemyDrops(itemName).catch(() => []),
        ]);
        const preview = buildRegularEmbed(itemName, dropData, enemyDrops, null);
        preview.addFields({ name: '⏳ Fetching market prices…', value: '\u200b', inline: false });
        await loadMsg.edit({ content: '', embeds: [preview] });

        const priceMap = await fetchRegularItemPrices(itemName);
        await loadMsg.edit({ content: '', embeds: [buildRegularEmbed(itemName, dropData, enemyDrops, priceMap)] });
      }
    } catch (err) {
      console.error(err);
      await loadMsg.edit(`⚠️ Error fetching **${itemName}**: ${err.message}`);
    }
  }

  // ── !wfhelp ────────────────────────────────────────────────────────────
  if (command === 'wfhelp') {
    return msg.reply({ embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🔮 Warframe Bot — Help')
      .addFields(
        { name: '`!relic <name>`',   value: 'Relic drops, chances (Intact→Radiant), mission locations, market prices.\n`!relic meso b3`  ·  `!relic axi a1`' },
        { name: '`!item <name>`',    value: 'Prime items: parts, relics, locations, set + part prices.\nOther items: drop locations + market price.\n`!item nova prime`  ·  `!item ash`' },
        { name: '💰 Price logic',    value: `Top ${PRICE_SAMPLE} cheapest in-game sell orders.\nSpread ≤ **${PRICE_DELTA_THRESHOLD}p** → average shown.\nSpread > **${PRICE_DELTA_THRESHOLD}p** → individual values shown.` },
        { name: '📊 Drop chances',   value: '🔵 Common: 25.33%→16.67%\n🟡 Uncommon: 11.00%→20.00%\n🔴 Rare: 2.00%→10.00%' },
      )
      .setFooter({ text: 'wiki.warframe.com · warframe.market' })] });
  }
});

client.login(token);