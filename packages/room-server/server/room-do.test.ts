import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRoomDO, type RoomConfig, type RoomEnv } from './room-do';
import { _resetNapCache } from '@gizmo564/platform/server/nap';
import { toyLogic } from './testing/toy-logic';

// ---- fakes for the bits of the Workers runtime the DO touches ----
class FakeSocket {
  sent: any[] = []; closed: string | null = null; att: unknown = null;
  send(s: string) { if (this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); }
  close(_c: number, reason: string) { this.closed = reason; }
  serializeAttachment(a: unknown) { this.att = JSON.parse(JSON.stringify(a)); }
  deserializeAttachment() { return this.att; }
  last(type?: string) { return [...this.sent].reverse().find((m) => !type || m.type === type); }
}
function fakeCtx() {
  const data = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  let alarm: number | null = null;
  const waits: Promise<unknown>[] = [];
  const ctx = {
    storage: {
      get: async (k: string) => (data.has(k) ? structuredClone(data.get(k)) : undefined),
      put: async (k: string, v: unknown) => { data.set(k, structuredClone(v)); },
      delete: async (k: string) => { data.delete(k); },
      deleteAll: async () => { data.clear(); },
      setAlarm: async (t: number) => { alarm = t; },
      deleteAlarm: async () => { alarm = null; },
    },
    getWebSockets: () => sockets,
    acceptWebSocket: (s: FakeSocket) => { sockets.push(s); },
    waitUntil: (p: Promise<unknown>) => { waits.push(p); },
  };
  return { ctx: ctx as unknown as DurableObjectState, data, sockets, alarm: () => alarm, waits };
}

class TestDO extends GameRoomDO<RoomEnv> {
  protected readonly cfg: RoomConfig = { logic: toyLogic, site: 'toy' };
}
const INDEX = { idFromName: (n: string) => n, get: () => ({ fetch: async () => new Response('ok') }) };
const env = (extra: Partial<RoomEnv> = {}) => ({ INDEX, NAP_URL: 'http://127.0.0.1:1/nap', IDLE_MS: '60000', NAP_TTL_MS: '0', ...extra }) as unknown as RoomEnv;
const send = (d: TestDO, ws: FakeSocket, m: object) => d.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(m));

/** Open a socket the way fetch('/ws') would (the WebSocketPair itself only exists in the real runtime). */
function connect(f: ReturnType<typeof fakeCtx>, id: number) { const ws = new FakeSocket(); ws.att = { conn: `conn${id}` }; f.sockets.push(ws); return ws; }

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { _resetNapCache(); fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('offline'); }); });
afterEach(() => { fetchSpy.mockRestore(); vi.useRealTimers(); });

async function created(extra: Partial<RoomEnv> = {}) {
  const f = fakeCtx(); const d = new TestDO(f.ctx, env(extra));
  const r = await d.fetch(new Request('https://room/create', { method: 'POST', body: 'abcd' }));
  expect(r.status).toBe(200);
  return { f, d };
}

describe('create / info / close', () => {
  it('creates once, refuses a bad code, reports info, and closes everything on admin close', async () => {
    const f = fakeCtx(); const d = new TestDO(f.ctx, env());
    expect((await d.fetch(new Request('https://room/create', { method: 'POST', body: 'a1' }))).status).toBe(400);
    expect((await d.fetch(new Request('https://room/info'))).status).toBe(404);
    expect((await d.fetch(new Request('https://room/create', { method: 'POST', body: 'abcd' }))).status).toBe(200);
    expect((await d.fetch(new Request('https://room/create', { method: 'POST', body: 'abcd' }))).status).toBe(409);
    expect(await (await d.fetch(new Request('https://room/info'))).json()).toEqual({ exists: true, started: false, players: 0, maxPlayers: 4 });
    expect(f.alarm()).toBeGreaterThan(Date.now());
    const ws = connect(f, 1);
    expect((await d.fetch(new Request('https://room/close', { method: 'POST' }))).status).toBe(200);
    expect(ws.last().type).toBe('closed'); expect(ws.last().reason).toBe('admin'); expect(ws.closed).toBe('admin');
    expect(f.data.size).toBe(0); expect(f.alarm()).toBeNull();
    expect((await d.fetch(new Request('https://room/info'))).status).toBe(404);
  });
  it('/ws needs an existing room and a websocket upgrade', async () => {
    const f = fakeCtx(); const d = new TestDO(f.ctx, env());
    expect((await d.fetch(new Request('https://room/ws'))).status).toBe(404);
    await d.fetch(new Request('https://room/create', { method: 'POST', body: 'abcd' }));
    expect((await d.fetch(new Request('https://room/ws'))).status).toBe(426);
    expect((await d.fetch(new Request('https://room/nope'))).status).toBe(404);
  });
});

describe('messages', () => {
  it('hello -> snapshot to that socket, everyone sees the new member, ping gets pong', async () => {
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello', name: 'Ann' });
    expect(a.last('state').members.map((m: any) => m.name)).toEqual(['Ann']);
    expect((a.att as any).member).toBeTruthy();
    await send(d, b, { type: 'hello', name: 'Bo' });
    expect(a.last('state').members.map((m: any) => m.name)).toEqual(['Ann', 'Bo']);
    expect(b.last('state').you.host).toBe(false);
    await send(d, a, { type: 'ping' });
    expect(a.last().type).toBe('pong');
  });
  it('ignores junk: bad JSON, no type, oversize, binary', async () => {
    const { f, d } = await created();
    const a = connect(f, 1);
    await d.webSocketMessage(a as unknown as WebSocket, '{nope');
    await d.webSocketMessage(a as unknown as WebSocket, '{"x":1}');
    await d.webSocketMessage(a as unknown as WebSocket, JSON.stringify({ type: 'hello', name: 'x'.repeat(30_000) }));
    await d.webSocketMessage(a as unknown as WebSocket, new ArrayBuffer(4));
    expect(a.sent).toEqual([]);
  });
  it('a rule error goes back to the sender only', async () => {
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello' }); await send(d, b, { type: 'hello' });
    const n = a.sent.length;
    await send(d, b, { type: 'start' });
    expect(b.last('error').message).toMatch(/only the host/);
    expect(a.sent.length).toBe(n);
  });
  it('plays a whole game, and the finished game is saved so a brand-new object (after eviction) continues it', async () => {
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello', name: 'Ann' }); await send(d, b, { type: 'hello', name: 'Bo' });
    await send(d, a, { type: 'settings', settings: { target: 2 } });
    await send(d, a, { type: 'start' });
    expect(a.last('state').started).toBe(true);
    // the DO is evicted from memory; sockets (and their attachments) survive; a new instance re-attaches them
    const d2 = new TestDO(f.ctx, env());
    await send(d2, a, { type: 'act', action: { type: 'tap' } });
    expect(a.last('state').view.taps[a.last('state').you.id]).toBe(1);
    await send(d2, a, { type: 'act', action: { type: 'tap' } });
    expect(a.last('state').over).toBe(true);
    expect(b.last('state').over).toBe(true);
  });
  it('a closed socket marks the member disconnected for everyone else', async () => {
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello' }); await send(d, b, { type: 'hello' });
    f.sockets.splice(f.sockets.indexOf(b), 1);
    await d.webSocketClose(b as unknown as WebSocket);
    expect(a.last('state').members.find((m: any) => !m.host).connected).toBe(false);
  });
  it('kick closes the removed player\'s socket with a reason', async () => {
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello' }); await send(d, b, { type: 'hello' });
    await send(d, a, { type: 'kick', id: b.last('state').you.id });
    expect(b.last('closed').reason).toBe('kicked'); expect(b.closed).toBe('kicked');
    expect(a.last('state').members.length).toBe(1);
  });
});

describe('alarms', () => {
  it('the alarm fires the game timer and broadcasts; with nothing to do it just reschedules', async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello' }); await send(d, b, { type: 'hello' });
    await send(d, a, { type: 'settings', settings: { timeLimitMs: 5000 } });
    await send(d, a, { type: 'start' });
    expect(f.alarm()).toBe(1_005_050);
    vi.setSystemTime(1_005_100);
    await d.alarm();
    expect(a.last('state').over).toBe(true);
    expect(a.last('state').events.map((e: any) => e.kind)).toEqual(['timeout', 'win']);
  });
  it('closes an idle room after the idle time and tells everyone', async () => {
    vi.useFakeTimers(); vi.setSystemTime(2_000_000);
    const { f, d } = await created({ IDLE_MS: '1000' });
    const a = connect(f, 1);
    await send(d, a, { type: 'hello' });
    vi.setSystemTime(2_000_000 + 1500);
    await d.alarm();
    expect(a.last('closed').reason).toBe('idle');
    expect(f.data.size).toBe(0);
  });
});

describe('ending a room', () => {
  it('the host ends it for everyone: sockets are told, storage is wiped (the code is free again); others cannot', async () => {
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello', name: 'Ann' }); await send(d, b, { type: 'hello', name: 'Bo' });
    await send(d, b, { type: 'end' });
    expect(b.last('error').message).toMatch(/only the host/);
    expect(f.data.size).toBeGreaterThan(0);
    await send(d, a, { type: 'end' });
    expect(a.last('closed').reason).toBe('host'); expect(b.last('closed').reason).toBe('host');
    expect(f.data.size).toBe(0);
  });
  it('when the last phone leaves the room closes after a few minutes, not half an hour (a TV alone does not count)', async () => {
    vi.useFakeTimers(); vi.setSystemTime(3_000_000);
    const { f, d } = await created({ IDLE_MS: String(30 * 60_000) });
    const tv = connect(f, 1), p = connect(f, 2);
    await send(d, tv, { type: 'hello', screen: true }); await send(d, p, { type: 'hello', name: 'Ann' });
    await d.webSocketClose(p as unknown as WebSocket);
    const wake = f.alarm()!;
    expect(wake - 3_000_000).toBeLessThanOrEqual(3 * 60_000 + 1500);
    vi.setSystemTime(wake + 10);
    await d.alarm();
    expect(tv.last('closed').reason).toBe('idle');
    expect(f.data.size).toBe(0);
  });
  it('a room with a phone still connected stays open', async () => {
    vi.useFakeTimers(); vi.setSystemTime(4_000_000);
    const { f, d } = await created({ IDLE_MS: String(30 * 60_000) });
    const p = connect(f, 1), q = connect(f, 2);
    await send(d, p, { type: 'hello', name: 'Ann' }); await send(d, q, { type: 'hello', name: 'Bo' });
    await d.webSocketClose(p as unknown as WebSocket);
    expect(f.alarm()! - 4_000_000).toBeGreaterThan(20 * 60_000);
  });
});

describe('nap guard', () => {
  const guard = (level: string, resetAt = 0) => fetchSpy.mockImplementation(async (u: any) => (String(u).includes('/nap') ? new Response(JSON.stringify({ level, percent: 99, resetAt })) : (() => { throw new Error('offline'); })()));
  it('asleep: the message is refused with a nap notice and the room freezes; waking pushes game time forward', async () => {
    vi.useFakeTimers(); vi.setSystemTime(5_000_000);
    const { f, d } = await created();
    const a = connect(f, 1), b = connect(f, 2);
    await send(d, a, { type: 'hello' }); await send(d, b, { type: 'hello' });
    await send(d, a, { type: 'settings', settings: { timeLimitMs: 60_000 } });
    await send(d, a, { type: 'start' });
    expect(a.last('state').deadline).toBe(5_060_000);
    guard('asleep', 5_100_000);
    _resetNapCache();
    vi.setSystemTime(5_010_000);
    const n = a.sent.length;
    await send(d, a, { type: 'act', action: { type: 'tap' } });
    expect(a.last().type).toBe('nap'); expect(a.last().resetAt).toBe(5_100_000);
    expect(a.sent.length).toBe(n + 1);
    expect(f.alarm()).toBe(5_101_000);
    // the guard opens again 100 s later; the next message thaws the room and shifts the deadline by the time slept
    guard('open'); _resetNapCache();
    vi.setSystemTime(5_110_000);
    await send(d, a, { type: 'ping' }); await send(d, a, { type: 'hello' });
    expect(a.last('state').deadline).toBe(5_060_000 + 100_000);
  });
});

describe('stats', () => {
  it('reports created / joined / finished once each, and never reports screens or bots as players', async () => {
    const calls: any[] = [];
    fetchSpy.mockImplementation(async (_u: any, init: any) => { calls.push(JSON.parse(init.body)); return new Response('{}'); });
    const f = fakeCtx(); const d = new TestDO(f.ctx, env({ STATS_URL: 'https://example.test/e', NAP_URL: undefined }));
    await d.fetch(new Request('https://room/create', { method: 'POST', body: 'abcd' }));
    const a = connect(f, 1), b = connect(f, 2), tv = connect(f, 3);
    await send(d, a, { type: 'hello' }); await send(d, b, { type: 'hello' }); await send(d, tv, { type: 'hello', screen: true });
    await send(d, a, { type: 'settings', settings: { target: 1 } }); await send(d, a, { type: 'start' }); await send(d, a, { type: 'act', action: { type: 'tap' } });
    await Promise.all(f.waits);
    const statsCalls = calls.filter((c) => c.site === 'toy').map((c) => c.type);
    expect(statsCalls).toEqual(['game_created', 'player_joined', 'player_joined', 'round_finished']);
  });
});
