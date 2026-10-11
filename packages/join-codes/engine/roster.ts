// Per-game view of the shared roster. The generic rules live in ./join-codes; the list of games lives in ./manifest.json
// (a copy of play/public/manifest.json, the single roster every game and the join page agree on).
//
// A game calls makeRoster once, in its own game-config file:
//
//   export const ROSTER = makeRoster('track-record');
//   ROSTER.randomCode()           // server: mint a code inside this game's letter block
//   ROSTER.isMyCode(text)         // client + server: right block and the check letter is correct
//   ROSTER.shareUrl(code)         // the lobby QR: the shared join page, which pre-fills the code
//
// A game that is not in the shared roster yet (a new one) passes its own entry as `own`; its letters replace any
// other game that claims them in THIS copy only, so a demo never changes the real roster.
import rosterJson from './manifest.json';
import { generate, validate, type GameEntry, type Manifest } from './join-codes';

export const PLAY_URL = 'https://play.0801564.xyz';
export const SHARED_MANIFEST = rosterJson as unknown as Manifest;

/** The manifest this game works with: the shared roster, plus (optionally) a game that is not registered yet. */
export function manifestWith(own?: GameEntry, base: Manifest = SHARED_MANIFEST): Manifest {
  if (!own) return base;
  const mine = new Set(own.letters);
  const games = base.games
    .filter((g) => g.id !== own.id)
    .map((g) => ({ ...g, letters: [...g.letters].filter((c) => !mine.has(c)).join('') }))
    .filter((g) => g.letters.length > 0);
  return { ...base, games: [...games, own] };
}

export interface Roster {
  gameId: string;
  manifest: Manifest;
  playUrl: string;
  /** a new room code in this game's letter block (pass a real random source on a server) */
  randomCode(rng?: () => number, isTaken?: (code: string) => boolean): string;
  /** true only for a well-formed code of THIS game */
  isMyCode(raw: string): boolean;
  /** the link the lobby QR code and "join at" line use */
  shareUrl(code: string): string;
}

export function makeRoster(gameId: string, opts: { own?: GameEntry; manifest?: Manifest; playUrl?: string } = {}): Roster {
  const manifest = manifestWith(opts.own, opts.manifest);
  const playUrl = opts.playUrl ?? PLAY_URL;
  if (!manifest.games.some((g) => g.id === gameId)) throw new Error(`game "${gameId}" is not in the roster; pass { own } or add it to manifest.json`);
  return {
    gameId, manifest, playUrl,
    randomCode: (rng, isTaken = () => false) => generate(manifest, gameId, isTaken, rng),
    isMyCode: (raw) => { const r = validate(manifest, raw); return r.ok && r.game.id === gameId; },
    shareUrl: (code) => `${playUrl}/?c=${code}`,
  };
}

/** A random source that is fine for room codes on a Worker (the Web Crypto API). */
export const cryptoRng = (): number => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
