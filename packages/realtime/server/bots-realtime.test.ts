import { describe, expect, it } from 'vitest';
import { BaseRoom } from '@gizmo564/room-server/server/base-room';
import type { ClientMsg } from '@gizmo564/room-server/server/protocol';
import { toyLogic, type ToyAction, type ToySettings, type ToyState, type ToyView } from '@gizmo564/room-server/server/testing/toy-logic';
import { botsAway } from '@gizmo564/bots-away/server/bots-away';
import { botsRealtime, MAX_REFUSALS, REPLAN_MS, type BotsRealtimeOptions } from './bots-realtime';

type Msg = ClientMsg<ToyAction, ToySettings>;
type R = BaseRoom<ToySettings, ToyState, ToyAction, ToyView>;
const plan: BotsRealtimeOptions<ToyState, ToyAction>['plan'] = (s, id) => (s.taps[id] !== undefined && !s.winner ? { action: { type: 'tap' }, afterMs: id.length * 0 + 500 } : null);
const mk = (opts: Partial<BotsRealtimeOptions<ToyState, ToyAction>> = {}, plugin?: 'away'): R =>
  new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', toyLogic, [plugin === 'away' ? botsAway(toyLogic) : botsRealtime(toyLogic, { plan, ...opts })], 3);
const hello = (r: R, c: string, now = 0) => r.handle(c, { type: 'hello', name: c } as Msg, now);
const send = (r: R, c: string, m: object, now = 0) => r.handle(c, m as Msg, now);
const taps = (r: R) => (r.game as ToyState).taps;
const setup = (r: R, target = 50) => {
  hello(r, 'h'); send(r, 'h', { type: 'bot', op: 'add' }); send(r, 'h', { type: 'settings', settings: { target } }); send(r, 'h', { type: 'start' }, 0);
};
const botId = (r: R) => r.members.find((m) => m.bot)!.id;
/** the human taps every 100 ms for `ms`; the room ticks whenever it is due */
function race(r: R, ms: number) {
  for (let t = 0; t <= ms; t += 100) {
    send(r, 'h', { type: 'act', action: { type: 'tap' } }, t);
    let guard = 0;
    while (guard++ < 5) { const w = r.nextWake(t); if (w == null || w > t) break; if (!r.tick(t)) break; }
  }
}

describe('independent timers', () => {
  it('a bot still plays while a human acts every 100 ms (the turn-based plugin starves it)', () => {
    const rt = mk(); setup(rt); race(rt, 2050);
    const bot = botId(rt);
    expect(taps(rt)[bot]).toBeGreaterThanOrEqual(3);          // ~every 500 ms
    const ta = mk({}, 'away'); setup(ta); race(ta, 2050);
    expect(taps(ta)[botId(ta)]).toBe(0);                      // documents WHY this package exists
  });

  it('each bot keeps its own schedule; the next wake is the earliest plan', () => {
    const delays: Record<number, number> = { 0: 400, 1: 1000 };
    const order: string[] = [];
    const r = mk({ plan: (s, id) => { const i = order.indexOf(id) < 0 ? order.push(id) - 1 : order.indexOf(id); return s.winner ? null : { action: { type: 'tap' }, afterMs: delays[i] ?? 400 }; } });
    hello(r, 'h'); send(r, 'h', { type: 'bot', op: 'add' }); send(r, 'h', { type: 'bot', op: 'add' });
    send(r, 'h', { type: 'settings', settings: { target: 20 } }); send(r, 'h', { type: 'start' }, 0);
    const [b1, b2] = r.members.filter((m) => m.bot).map((m) => m.id);
    r.nextWake(0); r.tick(0);
    // planning happens at wake time for both; the earlier plan fires first
    expect(r.nextWake(0)).toBeGreaterThan(0);
    r.tick(400); expect(taps(r)[b1] + taps(r)[b2]).toBeGreaterThanOrEqual(1);
  });

  it('a plan survives save/restore and shifts with the Nap Guard', () => {
    const r = mk(); setup(r, 20);
    r.nextWake(0); const wake = r.nextWake(0)!;
    expect(wake).toBe(500);
    const data = JSON.parse(JSON.stringify(r.toJSON()));
    const back = BaseRoom.restore<ToySettings, ToyState, ToyAction, ToyView>(data, toyLogic, [botsRealtime(toyLogic, { plan })]);
    expect(back.nextWake(0)).toBe(500);
    back.shiftTime(10_000);
    expect(back.nextWake(0)).toBe(10_500);
    back.tick(10_500);
    expect(taps(back)[botId(back)]).toBe(1);
  });
});

describe('refused and idle plans', () => {
  it('a refused plan is retried a few times, then the seat sleeps until the state changes', () => {
    let asked = 0;
    const strict = { ...toyLogic, act: (st: ToyState, id: string, a: ToyAction, c: never) => ((a as { type: string }).type === 'bogus' ? { ok: false as const, error: 'nope' } : toyLogic.act(st, id, a, c)) };
    const r = new BaseRoom<ToySettings, ToyState, ToyAction, ToyView>('ABCD', strict, [botsRealtime(strict, { plan: (s, id) => { asked++; return s.taps[id] !== undefined && !s.winner ? { action: { type: 'bogus' } as never, afterMs: 0 } : null; } })], 3);
    hello(r, 'h'); send(r, 'h', { type: 'bot', op: 'add' }); send(r, 'h', { type: 'start' }, 0);
    let now = 0;
    for (let i = 0; i < 20; i++) { r.nextWake(now); r.tick(now); now += REPLAN_MS + 1; }
    expect(asked).toBe(MAX_REFUSALS);                        // then it sleeps: no hot loop
    expect(r.nextWake(now)).toBeNull();                       // and asks the alarm for nothing
    send(r, 'h', { type: 'act', action: { type: 'tap' } }, now);   // the state changes: the seat wakes and plans again
    r.nextWake(now);
    expect(asked).toBeGreaterThan(MAX_REFUSALS);
  });

  it('null from plan means nothing to do: no alarm until the state changes', () => {
    const r = mk({ plan: () => null });
    setup(r);
    expect(r.nextWake(0)).toBeNull();
    send(r, 'h', { type: 'act', action: { type: 'tap' } }, 10);
    expect(r.nextWake(10)).toBeNull();
  });
});

describe('away humans and lobby', () => {
  it('a human who is away past the grace period is played by the plan; they get their seat back on return', () => {
    const r = mk({ awayGraceMs: 1000 });
    hello(r, 'a'); hello(r, 'b'); send(r, 'a', { type: 'settings', settings: { target: 50 } }); send(r, 'a', { type: 'start' }, 0);
    const b = r.members.find((m) => m.name === 'b')!;
    const token = r.snapshot('b')!.you.token;
    r.disconnect('b', 100);
    expect(r.nextWake(100)).toBe(1100);                        // becomes away
    r.tick(1100);
    expect(r.members.find((m) => m.id === b.id)!.away).toBe(true);
    r.tick(1700);
    expect(taps(r)[b.id]).toBe(1);
    r.handle('b9', { type: 'hello', token } as Msg, 2000); r.tick(2000);
    expect(r.members.find((m) => m.id === b.id)!.away).toBe(false);
  });

  it('lobby bot messages work the same as in bots-away', () => {
    const r = mk({ maxBots: 1 }); hello(r, 'h'); hello(r, 'g');
    expect(send(r, 'g', { type: 'bot', op: 'add' })).toMatch(/only the host/);
    expect(send(r, 'h', { type: 'bot', op: 'add' })).toBeNull();
    expect(send(r, 'h', { type: 'bot', op: 'add' })).toMatch(/at most 1/);
    expect(send(r, 'h', { type: 'bot', op: 'remove' })).toBeNull();
  });
});
