import { describe, it, expect } from 'vitest';
import { generate } from '@gizmo564/join-codes/engine/join-codes';
import manifestJson from '@gizmo564/join-codes/engine/manifest.json';
import { resolveLoad, createCaster, CAST_NAMESPACE } from './cast';
import type { Manifest } from '@gizmo564/join-codes/engine/join-codes';

const m = manifestJson as unknown as Manifest;
const code = (g: string) => generate(m, g, () => false);

describe('receiver: resolveLoad', () => {
  it('opens the display page of a live game, in calm mode', () => {
    const c = code('track-record');
    const r = resolveLoad(m, { type: 'load', game: 'track-record', code: c });
    expect(r).toEqual({ ok: true, url: `https://tracks.0801564.xyz/?room=${c}&role=display&cast=1` });
  });
  it('works for every live game', () => {
    for (const g of m.games.filter((x) => x.status === 'live')) {
      const r = resolveLoad(m, { type: 'load', game: g.id, code: code(g.id) });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.url.startsWith(g.origin + '/')).toBe(true);
    }
  });
  it('refuses junk, bad codes, wrong game, and anything not in the manifest', () => {
    const c = code('track-record');
    expect(resolveLoad(m, null).ok).toBe(false);
    expect(resolveLoad(m, { type: 'load', game: 'track-record', code: 'ABCX' }).ok).toBe(false);
    expect(resolveLoad(m, { type: 'load', game: 'sandwich-slam', code: c }).ok).toBe(false);
    expect(resolveLoad(m, { type: 'load', game: 'track-record', url: 'https://evil.example', code: 'zzzz' }).ok).toBe(false);
    expect(resolveLoad(m, { type: 'stop' }).ok).toBe(false);
  });
  it('refuses reserved games', () => {
    const m2: Manifest = { ...m, games: m.games.map((g) => (g.id === 'chameleon' ? { ...g, status: 'reserved' as const } : g)) };
    const r = resolveLoad(m2, { type: 'load', game: 'chameleon', code: code('chameleon') });
    expect(r.ok).toBe(false);
  });
});

describe('sender: createCaster', () => {
  function fakeWin() {
    const listeners: Record<string, (e: unknown) => void> = {};
    const sent: unknown[] = [];
    let castState = 'NOT_CONNECTED';
    let session: null | object = null;
    const ctx = {
      setOptions: (o: unknown) => { (ctx as { opts?: unknown }).opts = o; },
      addEventListener: (t: string, f: (e: unknown) => void) => { listeners[t] = f; },
      getCastState: () => castState,
      requestSession: async () => { castState = 'CONNECTED'; session = { sendMessage: async (ns: string, msg: unknown) => { sent.push([ns, msg]); }, getCastDevice: () => ({ friendlyName: 'Living Room' }) }; listeners.sess({ sessionState: 'SESSION_STARTED' }); },
      getCurrentSession: () => session as never,
      endCurrentSession: () => { castState = 'NOT_CONNECTED'; session = null; },
    };
    const win = {
      cast: { framework: { CastContext: { getInstance: () => ctx }, CastContextEventType: { CAST_STATE_CHANGED: 'cs', SESSION_STATE_CHANGED: 'sess' }, SessionState: { SESSION_STARTED: 'SESSION_STARTED', SESSION_RESUMED: 'SESSION_RESUMED', SESSION_ENDED: 'SESSION_ENDED' } } },
      chrome: { cast: { AutoJoinPolicy: { ORIGIN_SCOPED: 'origin_scoped' } } },
    };
    return { win, sent, ctx, setState: (s: string) => { castState = s; } };
  }
  it('stays unsupported without an App ID', async () => {
    const f = fakeWin();
    const c = createCaster({ appId: '', game: 'chameleon', getCode: () => 'LABC', win: f.win as never });
    await Promise.resolve();
    expect(c.view().state).toBe('unsupported');
  });
  it('becomes ready, then sends the room to the TV when a session starts', async () => {
    const f = fakeWin();
    const c = createCaster({ appId: 'ABC123', game: 'chameleon', getCode: () => 'LWQS', win: f.win as never });
    await new Promise((r) => setTimeout(r, 0));
    expect(c.view().state).toBe('ready');
    await c.start();
    expect(c.view()).toEqual({ state: 'casting', device: 'Living Room' });
    expect(f.sent).toEqual([[CAST_NAMESPACE, { type: 'load', game: 'chameleon', code: 'LWQS' }]]);
    c.stop();
  });
  it('hides itself when no device is around', async () => {
    const f = fakeWin();
    f.setState('NO_DEVICES_AVAILABLE');
    const c = createCaster({ appId: 'ABC123', game: 'chameleon', getCode: () => null, win: f.win as never });
    await new Promise((r) => setTimeout(r, 0));
    expect(c.view().state).toBe('no-devices');
  });
  it('a failed cast request shows as failed; closing the picker does not', async () => {
    const f = fakeWin();
    const c = createCaster({ appId: 'ABC123', game: 'chameleon', getCode: () => 'LWQS', win: f.win as never });
    await new Promise((r) => setTimeout(r, 0));
    f.ctx.requestSession = async () => { throw 'cancel'; };
    await c.start();
    expect(c.view().state).toBe('ready');
    f.ctx.requestSession = async () => { throw 'receiver_unavailable'; };
    await c.start();
    expect(c.view().state).toBe('failed');
    f.ctx.requestSession = async () => { throw 'cancel'; };
    await c.start();                       // trying again clears the failure
    expect(c.view().state).toBe('ready');
  });
});
