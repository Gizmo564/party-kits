import { describe, expect, it } from 'vitest';
import { BaseRoom } from '@gizmo564/room-server/server/base-room';
import type { ClientMsg } from '@gizmo564/room-server/server/protocol';
import { toyLogic, type ToyAction, type ToySettings, type ToyState, type ToyView } from '@gizmo564/room-server/server/testing/toy-logic';
import { botsAway, AWAY_GRACE_MS, BOT_THINK_MS } from './bots-away';

type Msg = ClientMsg<ToyAction, ToySettings>;
const logic = { ...toyLogic, awayAct: toyLogic.botAct };      // away humans tap like bots do
const mk = (opts = {}, l = logic) => new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', l, [botsAway(l, opts)], 3);
const hello = (r: BaseRoom<any, any, any, any>, c: string, now = 0, name = c) => r.handle(c, { type: 'hello', name } as Msg, now);
const send = (r: BaseRoom<any, any, any, any>, c: string, m: object, now = 0) => r.handle(c, m as Msg, now);
const taps = (r: BaseRoom<any, any, any, any>) => (r.game as ToyState).taps;

describe('bot messages', () => {
  it('host adds and removes bots in the lobby; limits and permissions hold', () => {
    const r = mk({ maxBots: 2 });
    hello(r, 'h'); hello(r, 'g');
    expect(send(r, 'g', { type: 'bot', op: 'add' })).toMatch(/only the host/);
    expect(send(r, 'h', { type: 'bot', op: 'add', level: 'hard' })).toBeNull();
    expect(send(r, 'h', { type: 'bot', op: 'add' })).toBeNull();
    expect(send(r, 'h', { type: 'bot', op: 'add' })).toMatch(/at most 2 bots/);
    expect(r.members.filter((m) => m.bot).map((m) => [m.name, m.data])).toEqual([['Bot 1', { level: 'hard' }], ['Bot 2', {}]]);
    const snap = r.snapshot('h')!;
    expect(snap.members.filter((m) => m.bot).every((m) => m.connected)).toBe(true);
    expect(send(r, 'h', { type: 'bot', op: 'remove' })).toBeNull();     // newest first
    expect(r.members.filter((m) => m.bot).map((m) => m.name)).toEqual(['Bot 1']);
    expect(send(r, 'h', { type: 'bot', op: 'remove' })).toBeNull();
    expect(send(r, 'h', { type: 'bot', op: 'remove' })).toBe('no such bot');
    expect(send(r, 'h', { type: 'bot', op: 'remove', id: r.members[0].id })).toBe('no such bot');
    expect(send(r, 'h', { type: 'bot', op: 'dance' } as never)).toMatch(/unknown bot/);
  });
  it('bots cannot push the room past its player limit', () => {
    const r = mk({ maxBots: 9 });
    for (const c of ['a', 'b', 'c']) hello(r, c);
    expect(send(r, 'a', { type: 'bot', op: 'add' })).toBeNull();
    expect(send(r, 'a', { type: 'bot', op: 'add' })).toMatch(/full \(4 players\)/);
  });
  it('maxBots is enforced and a started game locks bots', () => {
    const r = mk({ maxBots: 1 }, { ...logic, maxPlayers: 6 });
    hello(r, 'h');
    send(r, 'h', { type: 'bot', op: 'add' });
    expect(send(r, 'h', { type: 'bot', op: 'add' })).toMatch(/at most 1/);
    send(r, 'h', { type: 'start' }, 1);
    expect(send(r, 'h', { type: 'bot', op: 'remove' })).toMatch(/lobby/);
  });
  it('a lone human can start against a bot (the bot counts as a player)', () => {
    const r = mk(); hello(r, 'h');
    expect(send(r, 'h', { type: 'start' }, 1)).toMatch(/at least 2/);
    send(r, 'h', { type: 'bot', op: 'add' });
    expect(send(r, 'h', { type: 'start' }, 1)).toBeNull();
  });
});

describe('bots play', () => {
  it('a bot waits its thinking time, then plays one move per tick until it wins; nextWake follows', () => {
    const r = mk(); hello(r, 'h');
    send(r, 'h', { type: 'bot', op: 'add' }); send(r, 'h', { type: 'settings', settings: { target: 2 } });
    send(r, 'h', { type: 'start' }, 1000);
    const bot = r.members.find((m) => m.bot)!.id;
    expect(r.nextWake(1000)).toBe(1000 + BOT_THINK_MS);
    expect(r.tick(1000 + BOT_THINK_MS - 1)).toBe(false);
    expect(r.tick(1000 + BOT_THINK_MS)).toBe(true);
    expect(taps(r)[bot]).toBe(1);
    // the state changed, so the bot thinks again from "now"
    expect(r.nextWake(3000)).toBe(3000 + BOT_THINK_MS);
    expect(r.tick(3000 + BOT_THINK_MS)).toBe(true);
    expect(r.over).toBe(true);
    expect(r.nextWake(9999)).toBeNull();
    expect(r.tick(99999)).toBe(false);
  });
  it('a bot with nothing to do (a refused or null move) sleeps instead of spinning', () => {
    const idle = { ...logic, botAct: () => null };
    const r = mk({}, idle); hello(r, 'h'); send(r, 'h', { type: 'bot', op: 'add' }); send(r, 'h', { type: 'start' }, 0);
    r.nextWake(0);
    expect(r.tick(2000)).toBe(false);
    expect(r.nextWake(2000)).toBeNull();
    const refused = { ...logic, botAct: () => ({ type: 'nonsense' }) as unknown as ToyAction, act: (s: ToyState, id: string, a: ToyAction) => (a.type === 'tap' || a.type === 'pass' ? logic.act(s, id, a, { now: 0, seed: 0 }) : { ok: false as const, error: 'refused' }) };
    const r2 = mk({}, refused); hello(r2, 'h'); send(r2, 'h', { type: 'bot', op: 'add' }); send(r2, 'h', { type: 'start' }, 0);
    r2.nextWake(0);
    expect(r2.tick(2000)).toBe(false);
    expect(r2.nextWake(2000)).toBeNull();
  });
});

describe('away takeover and host handoff', () => {
  function table() {
    const r = mk(); hello(r, 'a', 0, 'Ann'); hello(r, 'b', 0, 'Bo');
    send(r, 'a', { type: 'settings', settings: { target: 3 } });
    send(r, 'a', { type: 'start' }, 10_000);
    return { r, a: r.members[0].id, b: r.members[1].id };
  }
  it('a disconnected player becomes "away" after the grace period, then awayAct plays for them', () => {
    const { r, b } = table();
    r.disconnect('b', 10_000);
    expect(r.nextWake(10_000)).toBe(10_000 + AWAY_GRACE_MS);
    expect(r.tick(10_000 + AWAY_GRACE_MS - 1)).toBe(false);
    expect(r.members[1].away).toBe(false);
    expect(r.tick(10_000 + AWAY_GRACE_MS)).toBe(true);          // flagged away
    expect(r.snapshot('a')!.members[1].away).toBe(true);
    expect(taps(r)[b]).toBe(0);
    const at = r.nextWake(10_000 + AWAY_GRACE_MS)!;
    expect(at).toBeGreaterThanOrEqual(10_000 + AWAY_GRACE_MS + 1);
    expect(r.tick(at + 10)).toBe(true);
    expect(taps(r)[b]).toBe(1);
  });
  it('rejoining by token ends the takeover', () => {
    const { r, b } = table();
    const token = r.snapshot('b')!.you.token;
    r.disconnect('b', 10_000);
    r.tick(10_000 + AWAY_GRACE_MS);
    expect(r.members.find((m) => m.id === b)!.away).toBe(true);
    r.handle('b9', { type: 'hello', token } as Msg, 50_000);
    const m = r.members.find((x) => x.id === b)!;
    expect(m.away).toBe(false);
    r.tick(50_000 + 10_000);
    expect(taps(r)[b]).toBe(0);
  });
  it('the host walking away hands the room to a connected human; nobody connected means no handoff', () => {
    const r = mk(); hello(r, 'a'); hello(r, 'b'); hello(r, 'c');
    r.disconnect('a', 1000);
    expect(r.tick(1000 + AWAY_GRACE_MS - 1)).toBe(false);
    expect(r.members[0].host).toBe(true);
    expect(r.tick(1000 + AWAY_GRACE_MS)).toBe(true);
    expect(r.members.filter((m) => m.host).map((m) => m.name)).toEqual(['b']);
    // everyone leaves: nothing to hand to
    r.disconnect('b', 2000); r.disconnect('c', 2000);
    r.tick(2000 + AWAY_GRACE_MS);
    expect(r.members.filter((m) => m.host).length).toBe(1);
  });
  it('handoff can be turned off', () => {
    const r = mk({ hostHandoff: false }); hello(r, 'a'); hello(r, 'b');
    r.disconnect('a', 0); r.tick(AWAY_GRACE_MS * 2);
    expect(r.members[0].host).toBe(true);
  });
  it('a spectator or screen is never made away or given a seat', () => {
    const r = mk(); hello(r, 'a'); hello(r, 'tv', 0, 'tv'); r.handle('tv2', { type: 'hello', screen: true } as Msg, 0);
    r.disconnect('tv2', 0);
    expect(r.tick(AWAY_GRACE_MS * 2)).toBe(false);
  });
});

describe('persistence and nap', () => {
  it('the plan survives a JSON round trip; a nap shifts pending bot times', () => {
    const r = mk(); hello(r, 'h'); send(r, 'h', { type: 'bot', op: 'add' }); send(r, 'h', { type: 'start' }, 1000);
    r.nextWake(1000);
    const data = JSON.parse(JSON.stringify(r.toJSON()));
    const back = BaseRoom.restore<ToySettings, ToyState, ToyAction, ToyView>(data, logic, [botsAway(logic)]);
    expect(back.nextWake(1000)).toBe(1000 + BOT_THINK_MS);
    back.shiftTime(5000);
    expect(back.nextWake(6000)).toBe(1000 + BOT_THINK_MS + 5000);
  });
  it('publishes the grace period for the client', () => {
    const r = mk({ awayGraceMs: 9000 }); hello(r, 'h');
    expect(r.snapshot('h')!.plugins).toEqual({ botsAway: { graceMs: 9000 } });
  });
});
