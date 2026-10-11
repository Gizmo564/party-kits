import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGameRequest } from './routes';
import type { RoomEnv } from './room-do';
import { makeRoster } from '@gizmo564/join-codes/engine/roster';
import { _resetNapCache } from '@gizmo564/platform/server/nap';

const roster = makeRoster('track-record');
const goodCode = roster.randomCode();
const otherCode = makeRoster('sandwich-slam').randomCode();

function setup(napLevel: 'open' | 'no-new' | 'asleep' = 'open') {
  const calls: string[] = [];
  const env = {
    NAP_URL: 'https://guard.test/nap', NAP_TTL_MS: '0',
    ROOMS: { idFromName: (n: string) => n, get: (id: string) => ({ fetch: async (u: any, init?: any) => { calls.push(`${id}:${typeof u === 'string' ? u : u.url}`); return new Response(JSON.stringify({ ok: true }), { status: 200 }); } }) },
    INDEX: { idFromName: (n: string) => n, get: () => ({ fetch: async () => new Response('ok') }) },
    ASSETS: { fetch: async () => new Response('asset') },
  } as unknown as RoomEnv;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ level: napLevel, percent: 90, resetAt: 123 })));
  const ctx = { waitUntil: () => {} } as unknown as ExecutionContext;
  return { env, ctx, calls, go: (path: string, init?: RequestInit, opts = {}) => handleGameRequest(new Request('https://x.test' + path, init), env, ctx, { roster, ...opts }) };
}
beforeEach(() => _resetNapCache());
afterEach(() => vi.restoreAllMocks());

describe('routes', () => {
  it('POST /api/rooms makes a room with a code from this game\'s block', async () => {
    const s = setup();
    const r = await s.go('/api/rooms', { method: 'POST' });
    const { code } = await r.json() as { code: string };
    expect(roster.isMyCode(code)).toBe(true);
    expect(s.calls[0]).toBe(`${code}:https://room/create`);
  });
  it('retries when a code is taken, then gives up with 503', async () => {
    const s = setup();
    s.env.ROOMS.get = (() => ({ fetch: async () => new Response('{}', { status: 409 }) })) as never;
    const r = await s.go('/api/rooms', { method: 'POST' });
    expect(r.status).toBe(503);
  });
  it('a code from another game or with a wrong check letter never reaches a Durable Object', async () => {
    const s = setup();
    expect((await s.go(`/api/rooms/${otherCode}`)).status).toBe(404);
    expect((await s.go(`/ws/${otherCode}`)).status).toBe(404);
    expect((await s.go('/api/rooms/ZZZZ')).status).toBe(404);
    expect(s.calls).toEqual([]);
    expect((await s.go(`/api/rooms/${goodCode.toLowerCase()}`)).status).toBe(200);
    expect(s.calls).toEqual([`${goodCode}:https://room/info`]);
  });
  it('websocket requests are forwarded with the upper-cased code', async () => {
    const s = setup();
    await s.go(`/ws/${goodCode.toLowerCase()}`);
    expect(s.calls[0]).toBe(`${goodCode}:https://room/ws?code=${goodCode}`);
  });
  it('nap guard: no-new blocks only room creation; asleep blocks everything in /api/rooms', async () => {
    let s = setup('no-new');
    expect((await s.go('/api/rooms', { method: 'POST' })).status).toBe(503);
    expect((await s.go(`/api/rooms/${goodCode}`)).status).toBe(200);
    _resetNapCache(); vi.restoreAllMocks();
    s = setup('asleep');
    const r = await s.go(`/api/rooms/${goodCode}`);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ napping: true, level: 'asleep', resetAt: 123 });
  });
  it('/api/nap reports the guard, uncached', async () => {
    const s = setup('no-new');
    const r = await s.go('/api/nap');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toMatchObject({ level: 'no-new' });
  });
  it('extra routes run before assets; null falls through; admin without a signature is refused', async () => {
    const s = setup();
    const extra = async (req: Request) => (new URL(req.url).pathname === '/api/custom' ? new Response('mine') : null);
    expect(await (await s.go('/api/custom', undefined, { extra })).text()).toBe('mine');
    expect(await (await s.go('/index.html', undefined, { extra })).text()).toBe('asset');
    const adm = await s.go('/api/admin/close-all', { method: 'POST' });
    expect([401, 403, 404]).toContain(adm.status);
  });
});
