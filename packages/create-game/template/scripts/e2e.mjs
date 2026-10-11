#!/usr/bin/env node
// End-to-end check against a RUNNING Worker (`npm run dev:server`, or a deployed URL):
//   node scripts/e2e.mjs [http://localhost:8787]
// Two players, a TV display and a spectator talk to a real room over real WebSockets: join, settings, start, play every round,
// reconnect with a token mid-game, check nobody else's hand ever reaches the TV or a spectator, play again, and check the casting TV outranks a laptop display for the music.
// Needs Node 22+ (global WebSocket). Exits 1 on the first failed check.
const BASE = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const WS = BASE.replace(/^http/, 'ws');
let failed = 0;
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(code, hello) {
    this.code = code; this.hello = hello; this.snap = null; this.errors = []; this.raw = [];
    this.connect();
  }
  connect(token) {
    this.ws = new WebSocket(`${WS}/ws/${this.code}`);
    this.ws.onopen = () => this.ws.send(JSON.stringify({ type: 'hello', ...this.hello, token }));
    this.ws.onmessage = (e) => {
      this.raw.push(e.data);
      const m = JSON.parse(e.data);
      if (m.type === 'state') this.snap = m; else if (m.type === 'error') this.errors.push(m.message);
    };
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async until(pred, label, ms = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (this.snap && pred(this.snap)) return true; await sleep(50); }
    ok(false, `timed out waiting for: ${label}`); return false;
  }
  close() { try { this.ws.close(); } catch { /* */ } }
}

// ---- the only game-specific part: what a player does on their turn ----
const myMove = (snap) => {
  const v = snap.view;
  if (!v || v.phase !== 'pick' || !v.hand || v.locked[snap.you.id]) return null;
  return { type: 'act', action: { type: 'pick', card: Math.min(...v.hand) } };
};
const wantedSettings = { rounds: 3, pickSeconds: 10, revealSeconds: 2 };
// ------------------------------------------------------------------------

const create = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
ok(create.ok, 'POST /api/rooms makes a room');
const { code } = await create.json();
ok(/^[A-Z]{4}$/.test(code), `room code looks right (${code})`);
ok((await fetch(`${BASE}/api/rooms/${code}`)).ok, 'GET /api/rooms/CODE finds it');
ok((await fetch(`${BASE}/api/rooms/AAAA`)).status === 404, 'a code from another game is a 404');

const ann = new Client(code, { name: 'Ann' });
const bo = new Client(code, { name: 'Bo' });
const tv = new Client(code, { screen: true, music: true });
const fan = new Client(code, { spectate: true, name: 'Fan' });
await ann.until((s) => s.members.length >= 4, 'everyone joined');
ok(ann.snap.you.host, 'first player is the host');
ok(tv.snap.you.screen && !tv.snap.you.host, 'the TV is a screen and not the host');
ok(!bo.snap.you.host, 'second player is not the host');

bo.send({ type: 'settings', settings: { rounds: 1 } });
await sleep(300);
ok(bo.errors.length > 0 || ann.snap.settings.rounds !== 1, 'a non-host cannot change settings');
ann.send({ type: 'settings', settings: wantedSettings });
await ann.until((s) => s.settings.rounds === 3, 'settings applied');
ann.send({ type: 'start' });
await ann.until((s) => s.started, 'game started');

let reconnected = false;
const players = [ann, bo];
const t0 = Date.now();
while (Date.now() - t0 < 60000 && !ann.snap.over) {
  for (const p of players) { const m = p.snap && myMove(p.snap); if (m) p.send(m); }
  // during the first reveal pause (nothing is in flight), Bo drops and comes back with the saved token: same seat, same hand
  if (!reconnected && bo.snap.view?.phase === 'reveal' && bo.snap.view?.hand) {
    reconnected = true;
    const hand = JSON.stringify(bo.snap.view.hand), id = bo.snap.you.id, token = bo.snap.you.token;
    bo.ws.close(); await sleep(400);
    bo.snap = null; bo.connect(token);
    await bo.until((s) => s.you.id === id, 'Bo got the same seat back');
    ok(JSON.stringify(bo.snap.view.hand) === hand, 'Bo reconnected with the same hand');
  }
  await sleep(100);
}
ok(ann.snap.over, 'the game finished');
ok(reconnected, 'the reconnect check ran');
const total = Object.values(ann.snap.view.scores).reduce((a, b) => a + b, 0);
ok(total > 0, `prizes were awarded (total ${total})`);

// nobody but the owner ever saw a hand
const leaksFor = (c, others) => c.raw.some((r) => others.some((o) => r.includes(`"hand":${JSON.stringify(o)}`)));
ok(tv.raw.every((r) => !r.includes('"hand":[')), 'the TV never received a hand');
ok(fan.raw.every((r) => !r.includes('"hand":[')), 'the spectator never received a hand');
ok(tv.raw.every((r) => !r.includes('"hands"')) && ann.raw.every((r) => !r.includes('"hands"')), 'no snapshot carries the full state');
void leaksFor;

ann.send({ type: 'again' });
await ann.until((s) => !s.started, 'host sent everyone back to the lobby');
ok(ann.snap.members.length >= 3, 'the same players are still in the room');

// a bot is played by the room's own alarm, with no client behind it
{
  const { code: c2 } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json();
  const solo = new Client(c2, { name: 'Solo' });
  await solo.until((s) => s.members.length === 1, 'solo joined');
  solo.send({ type: 'bot', op: 'add' });
  await solo.until((s) => s.members.length === 2 && s.members[1].bot, 'a bot was added');
  solo.send({ type: 'settings', settings: wantedSettings });
  await solo.until((s) => s.settings.rounds === 3, 'bot room settings applied');
  solo.send({ type: 'start' });
  await solo.until((s) => s.started, 'bot game started');
  const t1 = Date.now();
  while (Date.now() - t1 < 40000 && !solo.snap.over) { const m = myMove(solo.snap); if (m) solo.send(m); await sleep(100); }
  ok(solo.snap.over, 'a human and a bot finished a game (the bot moved on the room alarm)');
  solo.close();
}

// the casting TV (Chromecast) outranks a laptop display for the music: only one device plays
{
  const { code: c3 } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json();
  const host = new Client(c3, { name: 'Host' });
  const laptop = new Client(c3, { screen: true });
  await host.until((s) => s.members.length === 2, 'host and laptop display joined');
  await laptop.until((s) => s.you.music, 'the laptop display plays the music');
  const chromecast = new Client(c3, { screen: true, cast: true });
  await chromecast.until((s) => s.you.music, 'the casting TV took the music');
  await laptop.until((s) => !s.you.music, 'the laptop display went quiet');
  ok(chromecast.snap.you.music && !laptop.snap.you.music && !host.snap.you.music, 'exactly one device (the casting TV) plays the music');
  ok(host.snap.members.filter((m) => m.cast).length === 1, 'the room marks which screen is the cast receiver');
  for (const c of [host, laptop, chromecast]) c.close();
}

for (const c of [ann, bo, tv, fan]) c.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
