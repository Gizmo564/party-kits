#!/usr/bin/env node
// Does the TV screen fit? Opens the display page (?room=CODE&role=display) in a real browser at several TV sizes and fails if anything
// scrolls, is cut off, or runs outside the window: in the lobby and once a game has started.
//   node scripts/tv-check.mjs [http://localhost:8787]        (needs `npm run dev:server` running and a browser:
//   npm i -D playwright-core, and set CHROMIUM=/path/to/chrome if Playwright has no browser installed)
// Rules it enforces (the live games follow the same ones): the TV lobby shows the code, the QR and every joined player with their face,
// with nothing to tap; settings, Start and every control live on the host's phone; no scroll bars, ever.
const BASE = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '');
const WS = BASE.replace(/^http/, 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pw;
try { pw = await import('playwright-core'); } catch { console.error('tv-check needs playwright-core: npm i -D playwright-core'); process.exit(2); }
const SIZES = [[1280, 720], [1920, 1080], [1366, 768], [1024, 600], [3840, 2160], [1280, 1024]];
const NAMES = ['Ann', 'Bo', 'Cy', 'Di', 'Ed', 'Flo'];

class Client {
  constructor(code, hello) { this.snap = null; this.ws = new WebSocket(`${WS}/ws/${code}`); this.ws.onopen = () => this.ws.send(JSON.stringify({ type: 'hello', ...hello })); this.ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'state') this.snap = m; }; }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async until(pred, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (this.snap && pred(this.snap)) return true; await sleep(50); } return false; }
}

const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
let bad = 0;

// The in-game TV screen occasionally took over 8 s to appear when six pages loaded at once (seen 1 time in ~7 runs; cause not pinned down).
// Wait once, and on a miss reload that page and wait again, printing a WARN so a flake stays visible. A second miss fails the run.
async function waitDisplay(page, w, h) {
  try { await page.waitForSelector('[data-testid=display]', { timeout: 8000 }); }
  catch { console.log(`WARN display screen slow at ${w}x${h}; reloading once`); await page.reload(); await page.waitForSelector('[data-testid=display]', { timeout: 15000 }); }
}
async function check(page, label) {
  const r = await page.evaluate(() => {
    const de = document.documentElement, vh = innerHeight, vw = innerWidth;
    const v = Math.max(de.scrollHeight, document.body.scrollHeight) - vh, h = Math.max(de.scrollWidth, document.body.scrollWidth) - vw;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
      if (b.bottom > vh + 1 || b.right > vw + 1 || b.top < -1 || b.left < -1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} bottom=${Math.round(b.bottom)}/${vh} right=${Math.round(b.right)}/${vw}`);
    }
    const list = document.querySelector('[data-testid=players]');
    return { v, h, out: out.slice(0, 4), clip: list ? list.scrollHeight - list.clientHeight : 0 };
  });
  const ok = r.v <= 1 && r.h <= 1 && r.out.length === 0 && r.clip <= 1;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' ' + JSON.stringify(r)}`);
}

for (const n of [1, 3, 6]) {
  const { code } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json();
  const people = NAMES.slice(0, n).map((name) => new Client(code, { name }));
  await people[0].until((s) => s.members.length >= n);
  const pages = [];
  for (const [w, h] of SIZES) { const page = await browser.newPage({ viewport: { width: w, height: h } }); await page.goto(`${BASE}/?room=${code}&role=display`); pages.push([page, w, h]); }
  for (const [page, w, h] of pages) {
    await page.waitForSelector('[data-testid=tv-lobby]', { timeout: 8000 }); await page.waitForTimeout(400);
    await check(page, `lobby, ${n} player(s), ${w}x${h}`);
    const shown = await page.evaluate(() => ({ code: !!document.querySelector('[data-testid=room-code]'), qr: !!document.querySelector('.qr svg'), faces: document.querySelectorAll('[data-testid=players] .avatar-svg').length, buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /start game|add a bot|copy link/i.test(t)) }));
    const good = shown.code && shown.qr && shown.faces === n && shown.buttons.length === 0;
    if (!good) bad++;
    console.log(`${good ? 'ok  ' : 'FAIL'} lobby shows code, QR, ${n} face(s), no host controls, ${w}x${h}${good ? '' : ' ' + JSON.stringify(shown)}`);
  }
  if (n >= 2) {
    people[0].send({ type: 'start' }); await people[0].until((s) => s.started);
    for (const [page, w, h] of pages) { await waitDisplay(page, w, h); await page.waitForTimeout(700); await check(page, `game, ${n} players, ${w}x${h}`); }
  }
  for (const [page] of pages) await page.close();
  people.forEach((p) => p.ws.close());
}
await browser.close();
console.log(bad ? `\n${bad} check(s) failed` : '\nthe TV screens fit');
process.exit(bad ? 1 : 0);
