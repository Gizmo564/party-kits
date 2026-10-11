import { describe, expect, it } from 'vitest';
import { BaseRoom, MAX_MEMBERS, type RoomPlugin } from './base-room';
import type { ClientMsg, Snapshot } from './protocol';
import { toyLogic, type ToyAction, type ToySettings, type ToyState, type ToyView } from './testing/toy-logic';

type Msg = ClientMsg<ToyAction, ToySettings>;
const mk = (plugins: RoomPlugin[] = []) => new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', toyLogic, plugins, 7);
const hello = (r: BaseRoom<any, any, any, any>, conn: string, extra: Partial<Extract<Msg, { type: 'hello' }>> = {}, now = 1000) => r.handle(conn, { type: 'hello', ...extra } as Msg, now);
const snap = (r: BaseRoom<any, any, any, any>, conn: string) => r.snapshot(conn) as Snapshot<ToySettings, ToyView>;

/** a room with a host (c1) and a second player (c2) */
function lobby() {
  const r = mk();
  expect(hello(r, 'c1', { name: 'Ann' })).toBeNull();
  expect(hello(r, 'c2', { name: 'Bo' })).toBeNull();
  return r;
}

describe('joining', () => {
  it('first person is host; later ones are players; names are cleaned; colors and avatars are distinct', () => {
    const r = mk();
    hello(r, 'c1', { name: '  <b>Ann</b>\u0007 ' }); hello(r, 'c2'); hello(r, 'c3', { name: 'Cy' });
    const s = snap(r, 'c1');
    expect(s.members.map((m) => m.name)).toEqual(['bAnn/b', 'Player 2', 'Cy']);
    expect(s.members.map((m) => m.host)).toEqual([true, false, false]);
    expect(new Set(s.members.map((m) => m.color)).size).toBe(3);
    expect(new Set(s.members.map((m) => m.avatar)).size).toBe(3);
    expect(s.you.token.length).toBeGreaterThan(20);
  });
  it('says hello first, and an unknown connection gets no snapshot', () => {
    const r = mk();
    expect(r.handle('x', { type: 'start' } as Msg, 1)).toBe('say hello first');
    expect(r.snapshot('x')).toBeNull();
    expect(r.handle('x', { type: 'ping' } as Msg)).toBeNull();
  });
  it('rejoin by token keeps the same member, on a new connection, and lets the old one drop', () => {
    const r = lobby();
    const tok = snap(r, 'c2').you.token; const id = snap(r, 'c2').you.id;
    r.disconnect('c2', 2000);
    expect(snap(r, 'c1').members.find((m) => m.id === id)!.connected).toBe(false);
    hello(r, 'c9', { token: tok }, 3000);
    expect(snap(r, 'c9').you.id).toBe(id);
    expect(snap(r, 'c1').members.find((m) => m.id === id)!.connected).toBe(true);
    expect(r.members.length).toBe(2);
  });
  it('a wrong token makes a new member rather than hijacking another', () => {
    const r = lobby();
    hello(r, 'c5', { token: 'nope' });
    expect(r.members.length).toBe(3);
  });
  it('a full room turns players away but lets them watch; late joiners watch', () => {
    const r = mk();
    for (let i = 0; i < 4; i++) hello(r, `p${i}`);
    expect(hello(r, 'late')).toMatch(/full \(4 players\)/);
    expect(hello(r, 'w', { spectate: true })).toBeNull();
    expect(snap(r, 'w').you.role).toBe('spectator');
    expect(r.players().length).toBe(4);
  });
  it('caps total members', () => {
    const r = mk();
    for (let i = 0; i < MAX_MEMBERS; i++) hello(r, `w${i}`, { spectate: true });
    expect(hello(r, 'one-more', { spectate: true })).toMatch(/full/);
  });
  it('a started game turns new arrivals into spectators', () => {
    const r = lobby();
    r.handle('c1', { type: 'start' } as Msg, 5000);
    hello(r, 'c3', { name: 'Late' });
    expect(snap(r, 'c3').you.role).toBe('spectator');
  });
});

describe('screens, host and music', () => {
  it('a TV screen is a spectator, never host, and is the music device; the first phone in becomes host', () => {
    const r = mk();
    hello(r, 'tv', { screen: true });
    expect(snap(r, 'tv').members.some((m) => m.host)).toBe(false);
    hello(r, 'p1', { name: 'Ann' });
    hello(r, 'p2', { name: 'Bo' });
    let s = snap(r, 'p1');
    expect(s.members.find((m) => m.screen)!.music).toBe(true);
    expect(s.you.host).toBe(true); expect(s.you.music).toBe(false);
    expect(snap(r, 'p2').you.host).toBe(false);
    expect(r.handle('tv', { type: 'claimHost' } as Msg)).toMatch(/already has a host|screen/);
    expect(r.handle('p2', { type: 'claimHost' } as Msg)).toMatch(/already has a host/);
    expect(r.players().map((m) => m.name)).toEqual(['Ann', 'Bo']);
  });
  it('a spectator who joins a TV-only room does not become host; claimHost works when nobody hosts', () => {
    const r = mk();
    hello(r, 'tv', { screen: true });
    hello(r, 'w', { spectate: true });
    expect(r.host).toBeUndefined();
    expect(r.handle('w', { type: 'claimHost' } as Msg)).toBeNull();
  });
  it('leave: the host walking away hands host (and the music, without a TV) to the next connected player', () => {
    const r = mk();
    hello(r, 'a', { name: 'Ann' }); hello(r, 'b', { name: 'Bo' }); hello(r, 'c', { name: 'Cy' });
    r.disconnect('b', 5);                                   // Bo is not connected: skipped
    expect(r.handle('b', { type: 'leave' } as Msg)).toBe('say hello first');
    expect(r.handle('c', { type: 'leave' } as Msg)).toBeNull();     // not the host: nothing changes
    expect(r.host!.name).toBe('Ann');
    expect(r.handle('a', { type: 'leave' } as Msg)).toBeNull();
    expect(r.host!.name).toBe('Cy');
    expect(snap(r, 'c').you.music).toBe(true);
    expect(r.members.filter((m) => m.host).length).toBe(1);
  });
  it('leave with a TV connected: the TV keeps the music', () => {
    const r = mk();
    hello(r, 'tv', { screen: true }); hello(r, 'a', { name: 'Ann' }); hello(r, 'b', { name: 'Bo' });
    r.handle('a', { type: 'leave' } as Msg);
    expect(r.host!.name).toBe('Bo');
    expect(snap(r, 'b').you.music).toBe(false);
    expect(r.members.find((m) => m.screen)!.music).toBe(true);
  });
  it('the casting TV outranks another screen for the music, whichever joins first (Track Record, 2026-10-10)', () => {
    const music = (r: ReturnType<typeof mk>) => snap(r, 'c1').members.filter((m) => m.music).map((m) => m.name);
    // a laptop display first, then the Chromecast: the cast TV takes the music
    const r = mk(); hello(r, 'c1', { name: 'Ann' });
    hello(r, 'lap', { screen: true, name: 'Laptop' });
    expect(music(r)).toEqual(['Laptop']);
    hello(r, 'tv', { screen: true, cast: true, name: 'Cast' });
    expect(music(r)).toEqual(['Cast']);
    expect(snap(r, 'c1').members.find((m) => m.name === 'Cast')!.cast).toBe(true);
    expect(snap(r, 'c1').members.find((m) => m.name === 'Laptop')!.cast).toBeUndefined();
    // a display that joins while a cast TV is connected does not take it back
    hello(r, 'lap2', { screen: true, name: 'Laptop 2' });
    expect(music(r)).toEqual(['Cast']);
    // the cast TV leaves: the music goes to a remaining display, not to nobody
    r.disconnect('tv', 2000);
    expect(music(r).length).toBe(1);
    expect(music(r)[0]).toMatch(/Laptop/);
    // cast first, laptop second
    const r2 = mk(); hello(r2, 'c1', { name: 'Ann' });
    hello(r2, 'tv', { screen: true, cast: true, name: 'Cast' }); hello(r2, 'lap', { screen: true, name: 'Laptop' });
    expect(music(r2)).toEqual(['Cast']);
    // `cast` means nothing without `screen`
    const r3 = mk(); hello(r3, 'c1', { name: 'Ann', cast: true });
    expect(snap(r3, 'c1').members[0].cast).toBeUndefined();
  });
  it('the host phone is the music device when there is no TV; the device moves when it leaves', () => {
    const r = lobby();
    expect(snap(r, 'c1').you.music).toBe(true);
    r.disconnect('c1', 9);
    expect(r.members.some((m) => m.music)).toBe(false);
    hello(r, 'tv', { screen: true });
    expect(snap(r, 'tv').you.music).toBe(true);
    expect(r.handle('c2', { type: 'music', on: true } as Msg)).toMatch(/only the host/);
  });
  it('makeHost hands over to a connected human only', () => {
    const r = lobby();
    hello(r, 'tv', { screen: true });
    expect(r.handle('c1', { type: 'makeHost', id: snap(r, 'tv').you.id } as Msg)).toMatch(/cannot be the host/);
    expect(r.handle('c2', { type: 'makeHost', id: snap(r, 'c2').you.id } as Msg)).toMatch(/only the host/);
    expect(r.handle('c1', { type: 'makeHost', id: snap(r, 'c2').you.id } as Msg)).toBeNull();
    expect(snap(r, 'c2').you.host).toBe(true); expect(snap(r, 'c1').you.host).toBe(false);
    expect(r.members.filter((m) => m.host).length).toBe(1);
    r.disconnect('c1', 5);
    expect(r.transferHost(snap(r, 'c2').members[0].id)).toMatch(/not connected/);
  });
  it('kick removes a lobby member and reports their connections to close', () => {
    const r = lobby();
    const id = snap(r, 'c2').you.id;
    expect(r.handle('c2', { type: 'kick', id } as Msg)).toMatch(/only the host/);
    expect(r.handle('c1', { type: 'kick', id: snap(r, 'c1').you.id } as Msg)).toMatch(/yourself/);
    expect(r.handle('c1', { type: 'kick', id } as Msg)).toBeNull();
    expect(r.takeKicked()).toEqual(['c2']);
    expect(r.takeKicked()).toEqual([]);
    expect(r.members.length).toBe(1);
    expect(r.snapshot('c2')).toBeNull();
  });
});

describe('profile and settings', () => {
  it('profile: name, free color, avatar range, game fields', () => {
    const r = lobby();
    const other = snap(r, 'c2').you.id;
    const taken = snap(r, 'c1').members.find((m) => m.id === other)!.color;
    r.handle('c1', { type: 'profile', name: 'Annie', color: taken, avatar: 99, data: { team: 1 } } as Msg);
    const me = snap(r, 'c1').members[0];
    expect(me.name).toBe('Annie'); expect(me.color).not.toBe(taken); expect(me.avatar).not.toBe(99); expect(me.data).toEqual({ team: 1 });
    expect(r.handle('c1', { type: 'profile', data: { team: 7 } } as Msg)).toMatch(/team/);
    r.handle('c1', { type: 'profile', color: '#123456' } as Msg);
    expect(snap(r, 'c1').members[0].color).not.toBe('#123456');
  });
  it('settings: host only, cleaned, locked once started', () => {
    const r = lobby();
    expect(r.handle('c2', { type: 'settings', settings: { target: 5 } } as Msg)).toMatch(/only the host/);
    expect(r.handle('c1', { type: 'settings', settings: { target: 999 } } as Msg)).toBeNull();
    expect(snap(r, 'c1').settings.target).toBe(20);
    expect(r.handle('c1', { type: 'settings', settings: null as never } as Msg)).toBe('bad settings');
    r.handle('c1', { type: 'start' } as Msg, 1);
    expect(r.handle('c1', { type: 'settings', settings: { target: 2 } } as Msg)).toMatch(/started/);
    expect(r.handle('c1', { type: 'profile', name: 'x' } as Msg)).toMatch(/started/);
  });
});

describe('playing', () => {
  it('start rules: host only, enough players, once', () => {
    const r = mk(); hello(r, 'c1');
    expect(r.handle('c1', { type: 'start' } as Msg, 1)).toMatch(/at least 2/);
    hello(r, 'c2');
    expect(r.handle('c2', { type: 'start' } as Msg, 1)).toMatch(/only the host/);
    expect(r.handle('c1', { type: 'start' } as Msg, 1)).toBeNull();
    expect(r.handle('c1', { type: 'start' } as Msg, 1)).toBe('already started');
  });
  it('actions go through the logic as the sender; spectators and strangers cannot act', () => {
    const r = lobby(); hello(r, 'w', { spectate: true });
    expect(r.handle('c1', { type: 'act', action: { type: 'tap' } } as Msg, 1)).toBe('the game has not started');
    r.handle('c1', { type: 'settings', settings: { target: 2 } } as Msg);
    r.handle('c1', { type: 'start' } as Msg, 1);
    expect(r.handle('w', { type: 'act', action: { type: 'tap' } } as Msg, 2)).toMatch(/spectators/);
    r.handle('c1', { type: 'act', action: { type: 'tap' } } as Msg, 2);
    const a = snap(r, 'c1');
    expect(a.view!.taps[a.you.id]).toBe(1);
    expect(a.eventSeq).toBeGreaterThan(0);
    expect(a.events).toEqual([{ kind: 'tap', id: a.you.id }]);
    r.handle('c1', { type: 'act', action: { type: 'tap' } } as Msg, 3);
    expect(r.over).toBe(true);
    expect(r.handle('c2', { type: 'act', action: { type: 'tap' } } as Msg, 4)).toBe('the game is over');
  });
  it('every viewer gets their own masked view; the secret stays out of the lobby, players and the screen until it is safe', () => {
    const r = lobby(); hello(r, 'tv', { screen: true });
    r.handle('c1', { type: 'settings', settings: { target: 1 } } as Msg);
    expect(snap(r, 'c1').view).toBeNull();
    r.handle('c1', { type: 'start' } as Msg, 1);
    for (const c of ['c1', 'c2', 'tv']) expect(JSON.stringify(snap(r, c).view)).not.toContain('secret-');
    r.handle('c1', { type: 'act', action: { type: 'tap' } } as Msg, 2);
    expect(JSON.stringify(snap(r, 'c1').view)).toContain('secret-');
    expect(JSON.stringify(snap(r, 'tv').view)).not.toContain('secret-');
  });
  it('end: only the host, and it asks the Durable Object to close the room', () => {
    const r = lobby();
    expect(r.handle('c2', { type: 'end' } as Msg)).toMatch(/only the host/);
    expect(r.endRequested).toBe(false);
    expect(r.handle('c1', { type: 'end' } as Msg)).toBeNull();
    expect(r.endRequested).toBe(true);
  });
  it('again mid-game abandons the game only when the logic says it is abandonable', () => {
    const r = lobby();
    r.handle('c1', { type: 'start' } as Msg);
    expect(r.handle('c1', { type: 'again' } as Msg)).toMatch(/not over/);
    const abandonable = new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', { ...toyLogic, abandonable: true }, [], 7);
    hello(abandonable, 'c1', { name: 'Ann' }); hello(abandonable, 'c2', { name: 'Bo' });
    abandonable.handle('c1', { type: 'start' } as Msg);
    expect(abandonable.handle('c2', { type: 'again' } as Msg)).toMatch(/only the host/);
    expect(abandonable.handle('c1', { type: 'again' } as Msg)).toBeNull();
    expect(abandonable.started).toBe(false);
  });
  it('the action context tells the logic who the host is, and snapshots carry the server clock', () => {
    const seen: (string | null)[] = [];
    const spy = { ...toyLogic, act: (s: ToyState, seat: string, a: ToyAction, ctx: Parameters<typeof toyLogic.act>[3]) => { seen.push(ctx.hostId); return toyLogic.act(s, seat, a, ctx); } };
    const r = new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', spy, [], 7);
    hello(r, 'c1', { name: 'Ann' }); hello(r, 'c2', { name: 'Bo' });
    r.handle('c1', { type: 'start' } as Msg);
    r.handle('c2', { type: 'act', action: { type: 'tap' } } as Msg);
    expect(seen).toEqual([snap(r, 'c1').you.id]);
    expect(r.snapshot('c1', 123_456)!.serverNow).toBe(123_456);
  });
  it('again: host only, only when over, returns to the lobby with the same people', () => {
    const r = lobby();
    r.handle('c1', { type: 'settings', settings: { target: 1 } } as Msg); r.handle('c1', { type: 'start' } as Msg, 1);
    expect(r.handle('c1', { type: 'again' } as Msg)).toMatch(/not over/);
    r.handle('c2', { type: 'act', action: { type: 'tap' } } as Msg, 2);
    expect(r.handle('c2', { type: 'again' } as Msg)).toMatch(/only the host/);
    expect(r.handle('c1', { type: 'again' } as Msg)).toBeNull();
    expect(snap(r, 'c1').started).toBe(false);
    expect(r.members.length).toBe(2);
    expect(r.handle('c1', { type: 'start' } as Msg, 3)).toBeNull();
  });
  it('different games get different seeds, and the stream is stored', () => {
    const r = lobby();
    const a = r.nextSeed(), b = r.nextSeed();
    expect(a).not.toBe(b);
  });
});

describe('timers', () => {
  it('the deadline comes from the game, tick fires it once, and nextWake follows it', () => {
    const r = lobby();
    r.handle('c1', { type: 'settings', settings: { timeLimitMs: 5000 } } as Msg);
    expect(r.nextWake(0)).toBeNull();
    r.handle('c1', { type: 'start' } as Msg, 10_000);
    expect(r.nextWake(10_000)).toBe(15_000);
    expect(snap(r, 'c1').deadline).toBe(15_000);
    expect(r.tick(14_999)).toBe(false);
    expect(r.tick(15_000)).toBe(true);
    expect(r.over).toBe(true);
    expect(snap(r, 'c1').events.map((e) => (e as { kind: string }).kind)).toEqual(['timeout', 'win']);
    expect(r.tick(99_999)).toBe(false);
    expect(r.nextWake(99_999)).toBeNull();
  });
});

describe('persistence', () => {
  it('JSON round trip keeps everything and drops live connections; attach brings a surviving socket back', () => {
    const r = lobby();
    r.handle('c1', { type: 'start' } as Msg, 1);
    r.handle('c1', { type: 'act', action: { type: 'tap' } } as Msg, 2);
    const data = JSON.parse(JSON.stringify(r.toJSON()));
    expect(JSON.parse(JSON.stringify(r.toJSON()))).toEqual(r.toJSON());
    const back = BaseRoom.restore<ToySettings, ToyState, ToyAction, ToyView>(data, toyLogic);
    expect(back.snapshot('c1')).toBeNull();
    const id = r.snapshot('c1')!.you.id;
    back.attach('c1', id, 50);
    expect(JSON.stringify(back.snapshot('c1')!.view)).toBe(JSON.stringify(r.snapshot('c1')!.view));
    expect(back.nextSeed()).toBe(r.nextSeed());
    back.attach('zz', 'does-not-exist');
    expect(back.snapshot('zz')).toBeNull();
  });
});

describe('plugins', () => {
  it('hooks fire in the right places and can add their own messages and public data', () => {
    const log: string[] = [];
    let counter = 0;
    const plugin: RoomPlugin = {
      id: 'demo',
      save: () => ({ counter }), load: (d) => { counter = (d as { counter: number }).counter; },
      onConnect: (_r, m) => log.push(`connect:${m.name}`), onDisconnect: (_r, m) => log.push(`disconnect:${m.name}`),
      onStart: () => log.push('start'), onAgain: () => log.push('again'),
      onMessage: (_r, _m, msg) => ((msg as { type: string }).type === 'bot' ? (counter++, null) : undefined),
      decorate: (m, info) => { if (m.host) info.away = false; },
      publicData: () => ({ counter }),
    };
    const r = mk([plugin]);
    hello(r, 'c1', { name: 'Ann' }); hello(r, 'c2', { name: 'Bo' });
    r.handle('c1', { type: 'bot', op: 'add' } as Msg);
    r.handle('c1', { type: 'start' } as Msg, 1);
    r.disconnect('c2');
    expect(log).toEqual(['connect:Ann', 'connect:Bo', 'start', 'disconnect:Bo']);
    expect(snap(r, 'c1').plugins).toEqual({ demo: { counter: 1 } });
    expect(r.toJSON().plugins).toEqual({ demo: { counter: 1 } });
    const saved = r.toJSON();
    counter = 0;
    BaseRoom.restore(saved, toyLogic, [plugin]);
    expect(counter).toBe(1);
    expect(r.handle('c1', { type: 'nonsense' } as never)).toBe('unknown message');
  });
});

describe('logic hooks for richer games', () => {
  it('initialProfile seeds each new player (not watchers); view learns which device is looking; start gets the loaded context', () => {
    let seenExt: unknown;
    const logic = {
      ...toyLogic,
      initialProfile: (seated: number) => ({ team: seated % 2 }),
      start: (i: Parameters<typeof toyLogic.start>[0]) => { seenExt = i.ext; return toyLogic.start(i); },
      view: (s: ToyState, v: string | null, who?: { music: boolean; host: boolean; screen: boolean }) => ({ ...toyLogic.view(s, v), who }) as ToyView & { who?: unknown },
    };
    const r = new BaseRoom<ToySettings, ToyState, ToyAction, any>('ABCD', logic as any, [], 7);
    hello(r, 'c1', { name: 'Ann' }); hello(r, 'c2', { name: 'Bo' }); hello(r, 'c3', { name: 'Cy' }); hello(r, 'tv', { screen: true });
    const m = snap(r, 'c1').members;
    expect(m.map((x) => x.data?.team)).toEqual([0, 1, 0, undefined]);
    r.startExt = { songs: 3 };
    expect(r.handle('c1', { type: 'start' } as Msg, 2000)).toBeNull();
    expect(seenExt).toEqual({ songs: 3 });
    expect((snap(r, 'tv').view as any).who).toEqual({ music: true, host: false, screen: true });
    expect((snap(r, 'c1').view as any).who).toEqual({ music: false, host: true, screen: false });
  });
});
