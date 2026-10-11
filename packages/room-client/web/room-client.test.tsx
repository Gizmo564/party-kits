// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { createRoom, roomInfo, roomStore, parseJoinLink, useRoom, RoomGone, NapNotice, ConnectionBanner, type SocketLike } from './index';
import { makeRoster } from '@gizmo564/join-codes/engine/roster';

class FakeWS implements SocketLike {
  static all: FakeWS[] = [];
  readyState = 0; sent: any[] = [];
  onopen: SocketLike['onopen'] = null; onmessage: SocketLike['onmessage'] = null; onclose: SocketLike['onclose'] = null;
  constructor(public url: string) { FakeWS.all.push(this); }
  send(d: string) { this.sent.push(JSON.parse(d)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  say(m: object) { this.onmessage?.({ data: JSON.stringify(m) }); }
  drop() { this.readyState = 3; this.onclose?.(); }
}
const state = (token = 'tok1') => ({ type: 'state', v: 1, code: 'ABCD', you: { id: 'p1', token, role: 'player', host: true, screen: false, music: true }, members: [], settings: {}, started: false, over: false, view: null, events: [], eventSeq: 0, deadline: null, plugins: {} });
const mkHook = (opts = {}, fetcher?: typeof fetch) => renderHook(() => useRoom({ game: 'g', code: 'ABCD', opts: { name: 'Ann', ...opts }, socket: (u) => new FakeWS(u), fetcher }));

beforeEach(() => { FakeWS.all = []; localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useRoom', () => {
  it('connects to /ws/CODE, says hello with the saved token, stores the new token, and exposes the snapshot', () => {
    roomStore('g').saveToken('ABCD', 'old');
    const { result } = mkHook({ music: false });
    const ws = FakeWS.all[0];
    expect(ws.url).toMatch(/^wss?:\/\/.+\/ws\/ABCD$/);
    expect(result.current.status).toBe('connecting');
    act(() => ws.open());
    expect(ws.sent[0]).toMatchObject({ type: 'hello', name: 'Ann', token: 'old', music: false });
    act(() => ws.say(state('new')));
    expect(result.current.status).toBe('open');
    expect(result.current.snap!.you.id).toBe('p1');
    expect(roomStore('g').savedToken('ABCD')).toBe('new');
    expect(roomStore('other').savedToken('ABCD')).toBeUndefined();
  });
  it('sends pings, and send() goes out only when open', () => {
    const { result } = mkHook();
    const ws = FakeWS.all[0];
    act(() => result.current.send({ type: 'start' }));
    expect(result.current.error).toMatch(/Reconnecting/);
    act(() => ws.open());
    act(() => { vi.advanceTimersByTime(25_000); });
    expect(ws.sent.at(-1)).toEqual({ type: 'ping' });
    act(() => result.current.send({ type: 'start' }));
    expect(ws.sent.at(-1)).toEqual({ type: 'start' });
    act(() => ws.say({ type: 'error', message: 'nope' }));
    expect(result.current.error).toBe('nope');
    act(() => result.current.clearError());
    expect(result.current.error).toBe('');
  });
  it('reconnects with backoff after a drop and re-sends hello with the token it was given', () => {
    const { result } = mkHook();
    act(() => { FakeWS.all[0].open(); FakeWS.all[0].say(state('t9')); FakeWS.all[0].drop(); });
    expect(result.current.status).toBe('reconnecting');
    act(() => { vi.advanceTimersByTime(600); });
    expect(FakeWS.all.length).toBe(2);
    act(() => FakeWS.all[1].open());
    expect(FakeWS.all[1].sent[0].token).toBe('t9');
    act(() => FakeWS.all[1].drop()); // a successful open resets the backoff, so the next wait is 600 ms again
    act(() => { vi.advanceTimersByTime(599); });
    expect(FakeWS.all.length).toBe(2);
    act(() => { vi.advanceTimersByTime(2); });
    expect(FakeWS.all.length).toBe(3);
  });
  it('says the room is missing after repeated failures to get in, if the server confirms it', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    const { result } = mkHook({}, f);
    for (let i = 0; i < 8; i++) { act(() => { FakeWS.all.at(-1)!.drop(); }); await act(async () => { vi.advanceTimersByTime(6000); }); }
    expect(f).toHaveBeenCalled();
    expect(result.current.status).toBe('missing');
  });
  it('does not call the room missing once it has been in', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    const { result } = mkHook({}, f);
    act(() => { FakeWS.all[0].open(); FakeWS.all[0].say(state()); });
    for (let i = 0; i < 8; i++) { act(() => { FakeWS.all.at(-1)!.drop(); }); await act(async () => { vi.advanceTimersByTime(6000); }); }
    expect(f).not.toHaveBeenCalled();
    expect(result.current.status).toBe('reconnecting');
  });
  it('closed by the server ends the session for good; kicked forgets the token', () => {
    roomStore('g').saveToken('ABCD', 'abc');
    const { result } = mkHook();
    act(() => { FakeWS.all[0].open(); FakeWS.all[0].say({ type: 'closed', reason: 'kicked' }); FakeWS.all[0].drop(); });
    expect(result.current.status).toBe('ended'); expect(result.current.endedReason).toBe('kicked');
    expect(roomStore('g').savedToken('ABCD')).toBeUndefined();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(FakeWS.all.length).toBe(1);
  });
  it('nap: stops reconnecting, polls /api/nap, and reconnects when the guard opens', async () => {
    let level = 'asleep';
    const f = vi.fn(async () => new Response(JSON.stringify({ level }))) as unknown as typeof fetch;
    const { result } = mkHook({}, f);
    act(() => { FakeWS.all[0].open(); FakeWS.all[0].say({ type: 'nap', resetAt: 5000 }); FakeWS.all[0].drop(); });
    expect(result.current.napUntil).toBe(5000);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(FakeWS.all.length).toBe(1);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(FakeWS.all.length).toBe(1);
    level = 'open';
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(FakeWS.all.length).toBe(2);
    expect(result.current.napUntil).toBeNull();
  });
  it('ignores garbage frames and closes the socket on unmount', () => {
    const { unmount } = mkHook();
    act(() => { FakeWS.all[0].open(); FakeWS.all[0].onmessage?.({ data: '{oops' }); });
    unmount();
    expect(FakeWS.all[0].readyState).toBe(3);
  });
});

describe('api', () => {
  it('createRoom returns the code, or a player-safe message', async () => {
    expect(await createRoom((async () => new Response(JSON.stringify({ code: 'ABCD' }))) as unknown as typeof fetch)).toBe('ABCD');
    await expect(createRoom((async () => new Response('{}', { status: 500 })) as unknown as typeof fetch)).rejects.toThrow(/Could not create a room/);
    await expect(createRoom((async () => new Response(JSON.stringify({ napping: true, error: 'Busy day' }), { status: 503 })) as unknown as typeof fetch)).rejects.toThrow('Busy day');
  });
  it('roomInfo: exists, gone, or unreachable', async () => {
    expect(await roomInfo('ABCD', (async () => new Response(JSON.stringify({ exists: true, started: false }))) as unknown as typeof fetch)).toMatchObject({ exists: true });
    expect(await roomInfo('ABCD', (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch)).toEqual({ exists: false });
    await expect(roomInfo('ABCD', (async () => { throw new Error('down'); }) as unknown as typeof fetch)).rejects.toThrow('Could not reach the game server.');
  });
});

describe('links + storage', () => {
  const roster = makeRoster('track-record');
  const code = roster.randomCode();
  it('parses room, role and name; rejects foreign or mistyped codes', () => {
    expect(parseJoinLink(`?room=${code.toLowerCase()}&role=display&name=%20Ann%3Cb%3E`, roster)).toEqual({ code, role: 'display', name: 'Annb' });
    expect(parseJoinLink(`?c=${code}`, roster)).toEqual({ code, role: 'player', name: '' });
    expect(parseJoinLink(`?room=${makeRoster('sandwich-slam').randomCode()}`, roster).code).toBeNull();
    expect(parseJoinLink(`?room=${code}&role=audience`, roster).role).toBe('audience');
    expect(parseJoinLink(`?room=${code}&role=watch`, roster).role).toBe('audience');   // older spelling
    expect(parseJoinLink('?room=ZZZZ&role=boss', roster)).toEqual({ code: null, role: 'player', name: '' });
    expect(parseJoinLink('', roster).code).toBeNull();
  });
  it('storage never throws, even when the browser blocks it', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const s = roomStore('g');
    expect(() => { s.saveToken('ABCD', 'x'); s.rememberRoom('ABCD'); s.forgetRoom(); }).not.toThrow();
    expect(s.savedToken('ABCD')).toBeUndefined(); expect(s.lastRoom()).toBeNull();
  });
  it('remembers the last room', () => {
    const s = roomStore('g'); s.rememberRoom('ABCD'); expect(s.lastRoom()).toBe('ABCD'); expect(s.recent()).toBe('room'); s.rememberLocalGame(); expect(s.recent()).toBe('game'); s.forgetRoom(); expect(s.lastRoom()).toBeNull();
  });
});

describe('notices', () => {
  it('RoomGone explains each reason and offers the way out', () => {
    const left = vi.fn();
    const { rerender } = render(<RoomGone status="missing" onLeave={left} />);
    expect(screen.getByRole('alert').textContent).toMatch(/not here any more/);
    rerender(<RoomGone status="ended" reason="kicked" onLeave={left} />);
    expect(screen.getByRole('alert').textContent).toMatch(/removed you/);
    rerender(<RoomGone status="ended" reason="idle" onLeave={left} />);
    expect(screen.getByRole('alert').textContent).toMatch(/idle/);
    screen.getByText('Back to start').click(); expect(left).toHaveBeenCalled();
  });
  it('banners show only when relevant', () => {
    const { container, rerender } = render(<><ConnectionBanner status="open" /><NapNotice until={null} /></>);
    expect(container.textContent).toBe('');
    rerender(<><ConnectionBanner status="reconnecting" /><NapNotice until={Date.now() + 1000} /></>);
    expect(container.textContent).toMatch(/Reconnecting/); expect(container.textContent).toMatch(/napping/);
  });
});
