// Run: node debug_servers.js
// Tests every plausible Wynncraft v3 endpoint that might tie events to servers
const axios = require('axios');
const UA = { headers: { 'User-Agent': 'WynnEventBot/1.0' }, timeout: 8000 };
const BASE = 'https://api.wynncraft.com/v3';

const endpoints = [
  '/map/gameSessions',
  '/map/gameSessions/servers',
  '/map/gameSessions/list',
  '/map/servers',
  '/map/onlineServers',
  '/server/list',
  '/server',
  '/servers',
  '/network',
  '/network/servers',
  '/online',
  '/online/servers',
  '/map/world',
  '/map/worlds',
];

(async () => {
  for (const ep of endpoints) {
    try {
      const r = await axios.get(BASE + ep, UA);
      console.log(`✅ ${ep} → HTTP ${r.status} | ${JSON.stringify(r.data).slice(0, 200)}`);
    } catch (e) {
      console.log(`❌ ${ep} → ${e.response?.status ?? e.code}`);
    }
  }
})();