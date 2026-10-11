import { describe, expect, it } from 'vitest';
import { ALPHABET, BASE, capacity, checkLetter, falseHitChance, generate, joinUrl, normalize, validate, type GameEntry, type Manifest } from './join-codes';
import { cryptoRng, makeRoster, manifestWith, SHARED_MANIFEST as m } from './roster';

describe('shared roster', () => {
  it('letter blocks never overlap and only use the alphabet', () => {
    const seen = new Set<string>();
    for (const g of m.games) for (const ch of g.letters) { expect(ALPHABET.includes(ch), ch).toBe(true); expect(seen.has(ch), `overlap ${ch}`).toBe(false); seen.add(ch); }
    expect(seen.size).toBeLessThanOrEqual(BASE);
  });
  it('every live game has a block big enough to be useful', () => {
    for (const g of m.games) expect(capacity(m, g.id)).toBeGreaterThan(500);
  });
});

describe('generate + validate', () => {
  it('generated codes validate and map back to their game, and stay unique', () => {
    const taken = new Set<string>();
    for (const g of m.games.filter((x) => x.status !== 'reserved')) {
      for (let i = 0; i < 300; i++) {
        const c = generate(m, g.id, (x) => taken.has(x));
        taken.add(c);
        const r = validate(m, c);
        expect(r.ok && r.game.id === g.id, c).toBe(true);
      }
    }
  });

  it('catches every single-letter typo in the check letter, and most adjacent swaps', () => {
    const codes = Array.from({ length: 300 }, () => generate(m, 'track-record', () => false));
    let swaps = 0, swapsCaught = 0;
    for (const code of codes) {
      for (const pos of [1, 2, 3]) for (const ch of ALPHABET) {
        if (ch === code[pos]) continue;
        const t = code.slice(0, pos) + ch + code.slice(pos + 1);
        expect(validate(m, t).ok, `${code} -> ${t}`).toBe(false);
      }
      for (let pos = 0; pos < 3; pos++) if (code[pos] !== code[pos + 1]) {
        const t = code.slice(0, pos) + code[pos + 1] + code[pos] + code.slice(pos + 2);
        swaps++; if (!validate(m, t).ok) swapsCaught++;
      }
    }
    expect(swapsCaught / swaps).toBeGreaterThan(0.8);
  });

  it('explains why a code is rejected', () => {
    const reason = (s: string) => { const r = validate(m, s); return r.ok ? 'ok' : r.reason; };
    expect(reason('')).toBe('empty');
    expect(reason('AB')).toBe('too-short');
    expect(reason('AB1X')).toBe('bad-char');
    expect(reason('ABCDE')).toBe('too-long');
    expect(reason('L123')).toBe('bad-char');
    const reserved: Manifest = { ...m, games: m.games.map((g) => (g.id === 'chameleon' ? { ...g, status: 'reserved' as const } : g)) };
    expect(validate(reserved, 'LAAA')).toMatchObject({ ok: false, reason: 'reserved' });
    expect(validate(m, 'abc' + checkLetter('ABC')).ok).toBe(true);
    expect(normalize(' ab-cd ')).toBe('ABCD');
  });

  it('quotes the capacity numbers the README promises', () => {
    const noCheck: Manifest = { ...m, checksum: false };
    expect(capacity(m, 'track-record')).toBe(8 * 576);
    expect(capacity(noCheck, 'track-record')).toBe(8 * 13824);
    expect(falseHitChance(m, 'track-record', 100)).toBeLessThan(0.001);
  });

  it('refuses to mint a code for a reserved or unknown game', () => {
    const reserved: Manifest = { ...m, games: m.games.map((g) => (g.id === 'chameleon' ? { ...g, status: 'reserved' as const } : g)) };
    expect(() => generate(reserved, 'chameleon', () => false)).toThrow(/reserved/);
    expect(() => generate(m, 'nope', () => false)).toThrow();
  });

  it('says when a game has run out of codes', () => {
    expect(() => generate(m, 'track-record', () => true)).toThrow(/exhausted/);
  });
});

describe('joinUrl', () => {
  const g = m.games[0];
  it('builds the game link with optional role and name hints', () => {
    expect(joinUrl(g, 'ABCD')).toBe(`${g.origin}/?room=ABCD`);
    expect(joinUrl(g, 'ABCD', { role: 'display' })).toBe(`${g.origin}/?room=ABCD&role=display`);
    expect(joinUrl(g, 'ABCD', { role: 'player', name: 'Ann Lee' })).toBe(`${g.origin}/?room=ABCD&name=Ann+Lee`);
  });
});

describe('makeRoster', () => {
  it('knows its own codes and nobody else\'s', () => {
    const r = makeRoster('sandwich-slam');
    const code = r.randomCode(cryptoRng);
    expect(r.isMyCode(code)).toBe(true);
    expect(makeRoster('track-record').isMyCode(code)).toBe(false);
    expect(r.shareUrl(code)).toBe(`https://play.0801564.xyz/?c=${code}`);
  });
  it('throws for a game that is not in the roster unless it passes its own entry', () => {
    expect(() => makeRoster('brand-new')).toThrow(/not in the roster/);
    const own: GameEntry = { id: 'brand-new', name: 'Brand New', letters: 'AB', origin: 'https://new.0801564.xyz', status: 'live', roles: ['player', 'display'] };
    const r = makeRoster('brand-new', { own });
    const code = r.randomCode();
    expect(r.isMyCode(code)).toBe(true);
    expect('AB'.includes(code[0])).toBe(true);
  });
  it('a demo entry takes letters from the other games in its own copy only', () => {
    const own: GameEntry = { id: 'brand-new', name: 'Brand New', letters: 'ABC', origin: 'https://new.0801564.xyz', status: 'live' };
    const mm = manifestWith(own);
    const tr = mm.games.find((g) => g.id === 'track-record')!;
    expect(tr.letters).toBe('DEFGH');
    expect(m.games.find((g) => g.id === 'track-record')!.letters).toBe('ABCDEFGH');
    // and a game left with no letters disappears from the copy
    const greedy: GameEntry = { ...own, letters: 'ABCDEFGH' };
    expect(manifestWith(greedy).games.some((g) => g.id === 'track-record')).toBe(false);
  });
});
