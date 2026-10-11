// Plays a whole game through the real room code (BaseRoom + the bots-away plugin) with no network, the way a
// Durable Object would drive it: hello, bots, settings, start, act, tick.
import { describe, expect, it } from 'vitest';
import { BaseRoom } from '@gizmo564/room-server/server';
import { botsAway, BOT_THINK_MS } from '@gizmo564/bots-away/server';
import type { ClientMsg, Snapshot } from '@gizmo564/room-server/server';
import { luckyLogic } from './logic';
import { ROSTER, type LuckySettings, type LuckyView } from '@game/engine';

const mk = () => new BaseRoom('ABCD', luckyLogic, [botsAway(luckyLogic)], 42);
const send = (r: BaseRoom, c: string, m: ClientMsg<any, any>, now = 0) => r.handle(c, m, now);
const snap = (r: BaseRoom, c: string) => r.snapshot(c) as Snapshot<LuckySettings, LuckyView>;

describe('Lucky Draw in a room', () => {
  it('has a roster that accepts its own codes and rejects everyone else\'s', () => {
    for (let i = 0; i < 20; i++) expect(ROSTER.isMyCode(ROSTER.randomCode())).toBe(true);
    expect(ROSTER.isMyCode('ABCD')).toBe(false);
  });

  it('one human plus bots plays a full game with nobody else touching anything', () => {
    const r = mk();
    send(r, 'h', { type: 'hello', name: 'Ann' }, 0);
    send(r, 'h', { type: 'bot', op: 'add' }, 0);
    send(r, 'h', { type: 'bot', op: 'add' }, 0);
    send(r, 'h', { type: 'settings', settings: { rounds: 3, pickSeconds: 10, revealSeconds: 2 } }, 0);
    expect(send(r, 'h', { type: 'start' }, 1000)).toBeNull();
    expect(snap(r, 'h').started).toBe(true);

    // Ann plays her lowest card each round; bots move on the clock; the reveal pause and pick timer are driven by tick().
    let now = 1000;
    for (let i = 0; i < 400 && !r.over; i++) {
      const v = snap(r, 'h').view!;
      if (v.phase === 'pick' && !v.locked[snap(r, 'h').you.id]) send(r, 'h', { type: 'act', action: { type: 'pick', card: Math.min(...v.hand!) } }, now);
      const wake = r.nextWake(now);
      now = Math.max(now + 1, wake ?? now + BOT_THINK_MS);
      r.tick(now);
    }
    expect(r.over).toBe(true);
    const end = snap(r, 'h');
    expect(end.over).toBe(true);
    const total = Object.values(end.view!.scores).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('a spectator or TV never receives anybody\'s hand', () => {
    const r = mk();
    send(r, 'h', { type: 'hello', name: 'Ann' }, 0);
    send(r, 'g', { type: 'hello', name: 'Bo' }, 0);
    send(r, 'tv', { type: 'hello', screen: true }, 0);
    expect(send(r, 'h', { type: 'start' }, 1000)).toBeNull();
    const tv = snap(r, 'tv');
    expect(tv.view!.hand).toBeNull();
    expect(JSON.stringify(tv)).not.toContain('"hands"');
    const bo = snap(r, 'g').view!;
    const ann = snap(r, 'h').view!;
    expect(bo.hand).not.toEqual(ann.hand);
  });

  it('a refused move reaches only the sender and changes nothing', () => {
    const r = mk();
    send(r, 'h', { type: 'hello', name: 'Ann' }, 0);
    send(r, 'g', { type: 'hello', name: 'Bo' }, 0);
    send(r, 'h', { type: 'start' }, 1000);
    const before = JSON.stringify(r.game);
    expect(send(r, 'g', { type: 'act', action: { type: 'pick', card: 999 } }, 1100)).toMatch(/not in your hand/);
    expect(JSON.stringify(r.game)).toBe(before);   // the game is untouched (the room's own seed counter may advance, which is harmless)
  });
});
