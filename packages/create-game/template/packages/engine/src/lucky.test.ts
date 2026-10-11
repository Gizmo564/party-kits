import { describe, expect, it } from 'vitest';
import { expectDeterministic, expectJsonSafe, expectNoLeak } from '@gizmo564/engine-core/engine/contract';
import { act, awayAct, botAct, cleanProfile, cleanSettings, defaultSettings, deadline, isOver, resolveRound, shiftTime, start, tick, view, type LuckyState } from './lucky';

const seats = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const begin = (seed = 7, now = 1000): LuckyState => {
  const r = start({ seats, settings: defaultSettings(), seed, now });
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const play = (s: LuckyState, id: string, card: number, now = 2000) => {
  const r = act(s, id, { type: 'pick', card }, { now, seed: 1 });
  if (!r.ok) throw new Error(r.error);
  return r.value.state;
};
/** everyone plays their lowest card until the game is over, driving the clock with tick() */
function playOut(seed: number): LuckyState {
  let s = begin(seed);
  let now = 1000;
  for (let guard = 0; guard < 100 && !isOver(s); guard++) {
    now += 1000;
    if (s.phase === 'pick') for (const id of s.seats) { const a = awayAct(s, id); if (a) s = play(s, id, a.card, now); }
    else { const t = tick(s, s.endsAt!); if (t) s = t.state; }
  }
  return s;
}

describe('rules', () => {
  it('deals different cards from one shuffled deck, and a secret prize per round', () => {
    const s = begin();
    const all = Object.values(s.hands).flat();
    expect(all).toHaveLength(15);
    expect(new Set(all).size).toBe(15);
    expect(s.prizes).toHaveLength(5);
  });
  it('the highest unmatched card wins; matching cards cancel', () => {
    expect(resolveRound(3, 0, [{ id: 'a', card: 9 }, { id: 'b', card: 5 }]).winner).toBe('a');
    const r = resolveRound(3, 0, [{ id: 'a', card: 9 }, { id: 'b', card: 9 }, { id: 'c', card: 2 }]);
    expect(r.winner).toBe('c');
    expect(r.plays.filter((p) => p.cancelled).map((p) => p.id)).toEqual(['a', 'b']);
    expect(resolveRound(3, 0, [{ id: 'a', card: 4 }, { id: 'b', card: 4 }]).winner).toBeNull();
  });
  it('refuses bad moves with a reason', () => {
    const s = begin();
    const ctx = { now: 2000, seed: 1 };
    expect(act(s, 'zzz', { type: 'pick', card: 1 }, ctx).ok).toBe(false);
    expect(act(s, 'a', { type: 'pick', card: 999 }, ctx).ok).toBe(false);
    const once = play(s, 'a', s.hands.a[0]);
    expect(act(once, 'a', { type: 'pick', card: once.hands.a[0] }, ctx)).toMatchObject({ ok: false });
  });
  it('resolves the round when the last pick lands, then moves on after the reveal pause', () => {
    let s = begin();
    s = play(s, 'a', s.hands.a[0]);
    s = play(s, 'b', s.hands.b[0]);
    expect(s.phase).toBe('pick');
    s = play(s, 'c', s.hands.c[0], 5000);
    expect(s.phase).toBe('reveal');
    expect(s.endsAt).toBe(5000 + s.revealMs);
    expect(tick(s, 5000)).toBeNull();                 // too early
    const next = tick(s, s.endsAt!)!.state;
    expect(next.phase).toBe('pick');
    expect(next.round).toBe(1);
    expect(Object.values(next.picks).every((p) => p === null)).toBe(true);
  });
  it('the pick timer plays the lowest card for anyone who has not played', () => {
    let s = begin();
    s = play(s, 'a', s.hands.a[0]);
    const low = Math.min(...s.hands.b);
    const t = tick(s, s.endsAt!)!;
    expect(t.state.phase).toBe('reveal');
    expect(t.state.last!.plays.find((p) => p.id === 'b')!.card).toBe(low);
  });
  it('plays a whole game to the end and names winners', () => {
    const s = playOut(3);
    expect(s.phase).toBe('over');
    expect(deadline(s)).toBeNull();
    expect(Object.values(s.hands).every((h) => h.length === 0)).toBe(true);
  });
  it('rejects too many players for the deck', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}` }));
    expect(start({ seats: many, settings: defaultSettings(), seed: 1, now: 0 }).ok).toBe(false);
    expect(start({ seats: [{ id: 'solo' }], settings: defaultSettings(), seed: 1, now: 0 }).ok).toBe(false);
  });
});

describe('the three promises the room relies on', () => {
  it('is deterministic: same seed and moves, same state', () => {
    expectDeterministic((seed) => playOut(seed));
    expect(playOut(1)).not.toEqual(playOut(2));
  });
  it('state is JSON-safe at every phase', () => {
    let s = begin();
    expectJsonSafe(s);
    s = play(s, 'a', s.hands.a[0]); expectJsonSafe(s);
    s = tick(s, s.endsAt!)!.state; expectJsonSafe(s);
    expectJsonSafe(view(s, 'a'));
  });
  it('no view leaks another hand, a pending pick or a future prize', () => {
    let s = begin(11);
    s = play(s, 'b', s.hands.b[0]);
    const pendingB = s.picks.b!;
    // Cards are 1..30, so test for the whole JSON key + value, not for a bare number.
    const handB = JSON.stringify(s.hands.b), handC = JSON.stringify(s.hands.c);
    for (const viewer of ['a', null] as const) {
      const text = JSON.stringify(view(s, viewer));
      expectNoLeak(text, [handB, handC]);
      expect(text).not.toContain(`"b":${pendingB}`);
      expect(text).not.toContain(JSON.stringify(s.prizes));
    }
    const v = view(s, 'b');
    expect(v.hand).toEqual(s.hands.b);
    expect(v.locked.b).toBe(true);
    expect(view(s, null).hand).toBeNull();
    expect(view(s, 'a').prize).toBe(s.prizes[0]);
  });
});

describe('bots, away players, time and settings', () => {
  it('a bot plays a card it holds, the same one for the same seed', () => {
    const s = begin();
    const a = botAct(s, 'a', { seed: 5 })!;
    expect(s.hands.a).toContain(a.card);
    expect(botAct(s, 'a', { seed: 5 })).toEqual(a);
    expect(botAct(play(s, 'a', a.card), 'a', { seed: 5 })).toBeNull();
  });
  it('an away player plays their lowest card', () => {
    const s = begin();
    expect(awayAct(s, 'b')).toEqual({ type: 'pick', card: Math.min(...s.hands.b) });
  });
  it('shiftTime pushes the deadline', () => {
    const s = begin();
    expect(shiftTime(s, 500).endsAt).toBe(s.endsAt! + 500);
  });
  it('settings are clamped and nonsense is refused', () => {
    const cur = defaultSettings();
    expect(cleanSettings({ rounds: 99, pickSeconds: -4 }, cur)).toMatchObject({ rounds: 5, pickSeconds: 8 });
    expect(cleanSettings('x', cur)).toBe('bad settings');
  });
  it('profile accepts only the offered emoji', () => {
    expect(cleanProfile({}, { emoji: '🎲' })).toEqual({ emoji: '🎲' });
    expect(typeof cleanProfile({}, { emoji: '<script>' })).toBe('string');
    expect(cleanProfile({ emoji: '🍀' }, {})).toEqual({ emoji: '🍀' });
  });
});
