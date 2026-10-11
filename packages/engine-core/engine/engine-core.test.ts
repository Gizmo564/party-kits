import { describe, expect, it } from 'vitest';
import { Rng, forkRng, newSeed } from './rng';
import { bad, good, OK } from './result';
import { cleanName, cleanText, clampInt } from './text';
import { newMemberId, newToken, randomString } from './ids';
import { freeColor, PLAYER_COLORS } from './palette';
import { onlyFor } from './view';
import { expectDeterministic, expectJsonSafe, expectNoLeak } from './contract';

describe('Rng', () => {
  it('is deterministic for a seed and different for another', () => {
    const a = new Rng(42), b = new Rng(42), c = new Rng(43);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()));
    expect(xs).not.toEqual(Array.from({ length: 5 }, () => c.next()));
  });
  it('produces the known mulberry32 sequence, so a stored seed replays the same game forever', () => {
    const r = new Rng(1);
    expect(r.next()).toBeCloseTo(0.6270739405881613, 12);
    expect(r.next()).toBeCloseTo(0.002735721180215478, 12);
  });
  it('stays in range and shuffles without losing items', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) { const n = r.int(10); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThan(10); }
    for (let i = 0; i < 200; i++) { const n = r.between(3, 5); expect(n >= 3 && n <= 5).toBe(true); }
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(new Rng(9).shuffle([...arr]).sort()).toEqual(arr);
    expect(arr).toContain(new Rng(3).pick(arr));
  });
  it('state is a plain number, so a game can be saved mid-stream and resumed', () => {
    const a = new Rng(5); a.next(); a.next();
    const b = new Rng(a.state);
    expect(b.next()).toBe(a.next());
  });
  it('forks are independent of the main stream and of each other', () => {
    expect(forkRng(1, 2).next()).toBe(forkRng(1, 2).next());
    expect(forkRng(1, 2).next()).not.toBe(forkRng(1, 3).next());
    expect(typeof newSeed()).toBe('number');
  });
});

describe('result + text', () => {
  it('builds results', () => { expect(OK.ok).toBe(true); expect(bad('no')).toEqual({ ok: false, error: 'no' }); expect(good(3)).toEqual({ ok: true, value: 3 }); });
  it('cleans names', () => {
    expect(cleanText('  a<b>\u0000  c ', 10)).toBe('ab c');
    expect(cleanName('   ', 'Player 1')).toBe('Player 1');
    expect(cleanName('x'.repeat(50), 'p')).toHaveLength(20);
    expect(cleanName(undefined, 'p')).toBe('p');
  });
  it('clamps integers', () => {
    expect(clampInt(99, 1, 10, 3)).toBe(10);
    expect(clampInt(-5, 1, 10, 3)).toBe(1);
    expect(clampInt(4.6, 1, 10, 3)).toBe(5);
    expect(clampInt('x', 1, 10, 3)).toBe(3);
    expect(clampInt(NaN, 1, 10, 3)).toBe(3);
  });
});

describe('ids + palette', () => {
  it('makes unguessable-looking, unique tokens', () => {
    const t = new Set(Array.from({ length: 500 }, () => newToken()));
    expect(t.size).toBe(500);
    for (const x of t) expect(x).toMatch(/^[a-z0-9]{32}$/);
    expect(randomString(8)).toHaveLength(8);
  });
  it('member ids avoid the ones in use', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(newMemberId(ids));
    expect(ids.size).toBe(100);
  });
  it('hands out the first free color and wraps when full', () => {
    expect(freeColor([])).toBe(PLAYER_COLORS[0]);
    expect(freeColor([PLAYER_COLORS[0]])).toBe(PLAYER_COLORS[1]);
    expect(freeColor(PLAYER_COLORS, PLAYER_COLORS, 2)).toBe(PLAYER_COLORS[2]);
  });
});

describe('views + contract helpers', () => {
  it('shows a secret only to its owner', () => {
    expect(onlyFor(1, 1, 'ace', '?')).toBe('ace');
    expect(onlyFor(2, 1, 'ace', '?')).toBe('?');
    expect(onlyFor(null, 1, 'ace', '?')).toBe('?');
    expect(onlyFor(null, 1, 'ace', '?', true)).toBe('ace');
  });
  it('detects a leak and accepts a clean view', () => {
    expectNoLeak({ hand: ['?', '?'] }, ['queen-of-hearts']);
    expect(() => expectNoLeak({ hand: ['queen-of-hearts'] }, ['queen-of-hearts'])).toThrow();
    expectJsonSafe({ a: 1, b: [1, 2, { c: 'x' }] });
    expect(() => expectJsonSafe({ a: undefined, d: new Date(0) })).toThrow();
    expectDeterministic((seed) => { const r = new Rng(seed); return [r.next(), r.next()]; });
  });
});

import { assignTeams, cleanTeamProfile, groupByTeam, isTeam, teamOf } from './teams';
describe('teams', () => {
  it('validates team numbers', () => {
    expect(isTeam(0, 2)).toBe(true); expect(isTeam(1, 2)).toBe(true);
    expect(isTeam(2, 2)).toBe(false); expect(isTeam(-1, 2)).toBe(false); expect(isTeam(0.5, 2)).toBe(false); expect(isTeam('1', 2)).toBe(false);
  });
  it('cleanTeamProfile keeps other keys, rejects bad teams, ignores a patch without a team', () => {
    expect(cleanTeamProfile({ x: 1 }, { team: 1 }, 2)).toEqual({ x: 1, team: 1 });
    expect(cleanTeamProfile({ x: 1 }, {}, 2)).toEqual({ x: 1 });
    expect(cleanTeamProfile({}, { team: 5 }, 2)).toMatch(/team/);
  });
  it('teamOf falls back when nothing valid is chosen', () => {
    expect(teamOf({ team: 1 }, 0)).toBe(1); expect(teamOf({}, 1)).toBe(1); expect(teamOf(undefined, 0)).toBe(0); expect(teamOf({ team: 99 }, 0)).toBe(0);
  });
  it('assignTeams spreads unchosen seats round-robin and keeps chosen teams', () => {
    expect(assignTeams([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual({ a: 0, b: 1, c: 0 });
    expect(assignTeams([{ id: 'a', data: { team: 1 } }, { id: 'b' }])).toEqual({ a: 1, b: 1 });
  });
  it('groupByTeam sorts teams and leaves out empty ones', () => {
    expect(groupByTeam({ a: 2, b: 0, c: 2 })).toEqual([{ team: 0, ids: ['b'] }, { team: 2, ids: ['a', 'c'] }]);
  });
});
