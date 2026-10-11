// Shared room-code rules for every party game (plain TypeScript, no dependencies).
// Idea: the FIRST letter says which game owns the code, the LAST letter is an optional check letter.
// A join page can then reject typos and unknown games instantly, in the browser, with zero server queries,
// and only ask ONE game's server about codes that pass.

/** 24 letters: no I and no O (they look like 1 and 0). */
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const BASE = ALPHABET.length; // 24

export interface GameEntry {
  id: string;              // e.g. 'track-record'
  name: string;            // shown to players
  letters: string;         // the first letters this game owns, e.g. 'ABCDEFGH'
  origin: string;          // where the game lives, e.g. 'https://tracks.0801564.xyz'
  joinPath?: string;       // default '/?room={code}' (both live games read ?room=CODE)
  roles?: string[];        // roles offered on the join page, e.g. ['player','display']
  status?: 'live' | 'reserved'; // 'reserved' = letters held for a future game; codes are refused for now
}
export interface Manifest { checksum: boolean; games: GameEntry[] }

export type Check =
  | { ok: true; game: GameEntry; code: string }
  | { ok: false; reason: 'empty' | 'too-short' | 'too-long' | 'bad-char' | 'unknown-game' | 'reserved' | 'checksum'; hint: string };

export const normalize = (raw: string) => raw.toUpperCase().replace(/[\s-]/g, '');

const WEIGHTS = [1, 5, 7]; // all coprime with 24 -> every single wrong letter changes the check letter
export function checkLetter(prefix3: string): string {
  let s = 0;
  for (let i = 0; i < 3; i++) s += ALPHABET.indexOf(prefix3[i]) * WEIGHTS[i];
  return ALPHABET[s % BASE];
}

/** Instant, offline validation. Run it on every keystroke; call the game's server only when ok is true. */
export function validate(m: Manifest, raw: string): Check {
  const code = normalize(raw);
  if (!code) return { ok: false, reason: 'empty', hint: 'Enter the 4-letter code on the host screen.' };
  for (const ch of code) if (!ALPHABET.includes(ch)) return { ok: false, reason: 'bad-char', hint: /\d/.test(ch) ? 'Codes are letters only, no digits.' : `"${ch}" is not used in codes (no I or O).` };
  if (code.length > 4) return { ok: false, reason: 'too-long', hint: 'Codes are 4 letters.' };
  const game = m.games.find((g) => g.letters.includes(code[0]));
  if (!game) return { ok: false, reason: 'unknown-game', hint: `No game uses codes starting with ${code[0]}.` };
  if (game.status === 'reserved') return { ok: false, reason: 'reserved', hint: `${game.name} is not available through this page yet.` };
  if (code.length < 4) return { ok: false, reason: 'too-short', hint: `Looks like a ${game.name} code - keep typing.` };
  if (m.checksum && checkLetter(code.slice(0, 3)) !== code[3]) return { ok: false, reason: 'checksum', hint: 'That code has a typo. Check the host screen and try again.' };
  return { ok: true, game, code };
}

/** What a game's server uses to mint a new code. Pass a collision test (is this code in use?) so codes stay unique. */
export function generate(m: Manifest, gameId: string, isTaken: (code: string) => boolean, rng: () => number = Math.random): string {
  const g = m.games.find((x) => x.id === gameId);
  if (!g || g.status === 'reserved') throw new Error(`unknown or reserved game: ${gameId}`);
  for (let tries = 0; tries < 200; tries++) {
    const first = g.letters[Math.floor(rng() * g.letters.length)];
    const a = ALPHABET[Math.floor(rng() * BASE)];
    const b = ALPHABET[Math.floor(rng() * BASE)];
    const c = m.checksum ? checkLetter(first + a + b) : ALPHABET[Math.floor(rng() * BASE)];
    const code = first + a + b + c; // with checksum on, c is derived from first+a+b
    if (!isTaken(code)) return code;
  }
  throw new Error('code space for this game is exhausted');
}

/** Number of distinct codes a game can hand out (the ceiling on simultaneous rooms for that game). */
export function capacity(m: Manifest, gameId: string): number {
  const g = m.games.find((x) => x.id === gameId)!;
  return g.letters.length * BASE * BASE * (m.checksum ? 1 : BASE);
}

/** Chance that a random WRONG 4-letter string (a typo / a guess) lands on a live room of the given game. */
export function falseHitChance(m: Manifest, gameId: string, liveRooms: number): number {
  const g = m.games.find((x) => x.id === gameId)!;
  const space = g.letters.length * BASE * BASE * BASE;
  return Math.min(1, liveRooms / space);
}

/** Where the join page sends a player. role/name are optional hints the game may honour. */
export function joinUrl(g: GameEntry, code: string, opts: { role?: string; name?: string } = {}) {
  const u = new URL(g.origin + (g.joinPath ?? '/?room={code}').replace('{code}', code));
  if (opts.role && opts.role !== 'player') u.searchParams.set('role', opts.role);
  if (opts.name) u.searchParams.set('name', opts.name);
  return u.toString();
}
