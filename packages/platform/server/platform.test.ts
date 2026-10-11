import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetNapCache, getNap, napMessage } from './nap';
import { justFinished, reporter, reportEvent, statsUrl } from './stats';
import { handleAdmin, indexAdd, indexRemove, signCall, verifyCall, type AdminEnv } from './party-admin';

const guard = (body: unknown, ok = true, status = 200) => vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);

describe('nap guard client', () => {
  beforeEach(() => { _resetNapCache(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('passes the guard\'s answer through', async () => {
    vi.stubGlobal('fetch', guard({ level: 'no-new', percent: 88, resetAt: 123 }));
    expect(await getNap({})).toMatchObject({ level: 'no-new', percent: 88, resetAt: 123, source: 'guard' });
  });
  it('fails open when the guard is down, slow, or confused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    expect(await getNap({})).toMatchObject({ level: 'open', source: 'failopen' });
    _resetNapCache();
    vi.stubGlobal('fetch', guard({}, false, 500));
    expect(await getNap({})).toMatchObject({ level: 'open', err: 'guard answered 500' });
    _resetNapCache();
    vi.stubGlobal('fetch', guard({ level: 'weird' }));
    expect(await getNap({})).toMatchObject({ level: 'open', err: expect.stringContaining('unexpected') });
  });
  it('reuses a fresh answer and never makes a message wait once it has one', async () => {
    const f = guard({ level: 'asleep', percent: 99, resetAt: 5 });
    vi.stubGlobal('fetch', f);
    await getNap({}, 1000);
    await getNap({}, 2000);
    expect(f).toHaveBeenCalledTimes(1);
    // stale: returns the old answer at once and refreshes in the background
    const waits: Promise<unknown>[] = [];
    f.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ level: 'open', percent: 1, resetAt: 5 }) }) as unknown as Response);
    const stale = await getNap({}, 1000 + 60_000, (p) => waits.push(p));
    expect(stale.level).toBe('asleep');
    await Promise.all(waits);
    expect((await getNap({}, 1000 + 61_000)).level).toBe('open');
  });
  it('has wording for both states', () => {
    expect(napMessage({ level: 'asleep' })).toMatch(/napping/);
    expect(napMessage({ level: 'no-new' })).toMatch(/new games are paused/);
  });
});

describe('stats', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('is off unless STATS_URL is set, and off for local runs against the live site', () => {
    expect(statsUrl({})).toBeNull();
    expect(statsUrl({ STATS_URL: 'https://0801564.xyz/api/event' })).toBe('https://0801564.xyz/api/event');
    expect(statsUrl({ STATS_URL: 'https://0801564.xyz/api/event', NAP_URL: 'http://localhost:8787/api/nap' })).toBeNull();
  });
  it('posts one tiny body and never throws', async () => {
    const f = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response);
    vi.stubGlobal('fetch', f);
    const waits: Promise<unknown>[] = [];
    reportEvent({ STATS_URL: 'https://x/api/event' }, (p) => waits.push(p), 'mygame', 'game_created');
    reporter({ STATS_URL: 'https://x/api/event' }, (p) => waits.push(p), 'mygame')('player_joined', { peak: 4 });
    await Promise.all(waits);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ site: 'mygame', type: 'game_created' });
    expect(JSON.parse((f.mock.calls[1] as unknown as [string, { body: string }])[1].body)).toEqual({ site: 'mygame', type: 'player_joined', peak: 4 });
    reportEvent({ STATS_URL: 'https://x' }, () => { throw new Error('waitUntil exploded'); }, 's', 'game_created'); // swallowed
    reportEvent({}, () => { throw new Error('must not be called'); }, 's', 'game_created');
  });
  it('counts a finished round once', () => {
    expect(justFinished('playing', 'roundEnd')).toBe(true);
    expect(justFinished('roundEnd', 'gameEnd')).toBe(false);
    expect(justFinished('playing', 'playing')).toBe(false);
  });
});

describe('party admin', () => {
  const now = 1_700_000_000_000;
  it('accepts a correctly signed call and refuses everything else', async () => {
    const sig = await signCall('s3cret', now, '/api/admin/open');
    expect(await verifyCall('s3cret', String(now), '/api/admin/open', sig, now)).toBe(true);
    expect(await verifyCall('s3cret', String(now), '/api/admin/close-all', sig, now)).toBe(false);   // wrong path
    expect(await verifyCall('other', String(now), '/api/admin/open', sig, now)).toBe(false);          // wrong secret
    expect(await verifyCall('s3cret', String(now), '/api/admin/open', sig, now + 6 * 60_000)).toBe(false); // too old
    expect(await verifyCall(undefined, String(now), '/api/admin/open', sig, now)).toBe(false);        // no secret configured
    expect(await verifyCall('s3cret', null, '/api/admin/open', null, now)).toBe(false);
    expect(await verifyCall('s3cret', String(now), '/api/admin/open', '!!!notbase64', now)).toBe(false);
  });

  function fakeIndex() {
    const codes = new Set<string>();
    const ns = { idFromName: (n: string) => n, get: () => ({ fetch: async (u: string) => {
      const url = new URL(u); const code = url.searchParams.get('code') ?? '';
      if (url.pathname === '/add') codes.add(code);
      if (url.pathname === '/remove') codes.delete(code);
      return new Response(JSON.stringify(url.pathname === '/list' ? { codes: [...codes] } : { ok: true }));
    } }) } as unknown as DurableObjectNamespace;
    return { codes, env: { INDEX: ns, ADMIN_KEY: 'k' } as AdminEnv };
  }
  const call = async (env: AdminEnv, path: string, method: string, signedPath = path) => {
    const ts = Date.now();
    const sig = await signCall(env.ADMIN_KEY!, ts, signedPath);
    return new Request('https://game.example' + path, { method, headers: { 'x-admin-ts': String(ts), 'x-admin-sig': sig } });
  };

  it('counts open rooms and closes them all', async () => {
    const { codes, env } = fakeIndex();
    await indexAdd(env, 'ABCD'); await indexAdd(env, 'EFGH');
    expect(codes.size).toBe(2);
    const closed: string[] = [];
    const open = await handleAdmin(await call(env, '/api/admin/open', 'GET'), env, async (c) => { closed.push(c); });
    expect(await open!.json()).toEqual({ open: 2 });
    const all = await handleAdmin(await call(env, '/api/admin/close-all', 'POST'), env, async (c) => { closed.push(c); });
    expect(await all!.json()).toEqual({ found: 2, closed: 2 });
    expect(closed.sort()).toEqual(['ABCD', 'EFGH']);
    expect(codes.size).toBe(0);
    await indexRemove(env, 'ZZZZ'); // removing something that is not there is fine
  });
  it('refuses unsigned calls, wrong methods, and ignores other paths', async () => {
    const { env } = fakeIndex();
    const unsigned = await handleAdmin(new Request('https://g/api/admin/open'), env, async () => undefined);
    expect(unsigned!.status).toBe(403);
    const wrongSig = await handleAdmin(await call(env, '/api/admin/open', 'GET', '/api/admin/close-all'), env, async () => undefined);
    expect(wrongSig!.status).toBe(403);
    const wrongMethod = await handleAdmin(await call(env, '/api/admin/open', 'POST'), env, async () => undefined);
    expect(wrongMethod!.status).toBe(405);
    expect(await handleAdmin(new Request('https://g/api/rooms'), env, async () => undefined)).toBeNull();
  });
  it('refuses everything when ADMIN_KEY is not set', async () => {
    const { env } = fakeIndex();
    const noKey = { ...env, ADMIN_KEY: undefined };
    const req = await call(env, '/api/admin/open', 'GET');
    expect((await handleAdmin(req, noKey, async () => undefined))!.status).toBe(403);
  });
});
