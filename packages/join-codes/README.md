# join-codes: one code alphabet for every party game

A room code is 4 letters from a 24-letter alphabet (A-Z without I and O).

- **Letter 1 picks the game.** Each game owns a block of first letters, listed in the manifest. The code alone says which game it is.
- **Letter 4 is a check letter** (`checksum: true`). It is computed from letters 1-3, so a mistyped code is rejected in the browser before any server is asked.
- The join page (`play.0801564.xyz`) runs `validate()` on every keystroke. Invalid codes get an instant message with no network call. A valid-looking code costs one lookup against ONE game's server.

## Files (copied into `packages/engine/src/kit/join-codes/`)

| File | What it is |
| --- | --- |
| `join-codes.ts` | The generic rules: `validate`, `generate`, `capacity`, `joinUrl`. No dependencies. |
| `roster.ts` | `makeRoster('your-game')` gives a game its `randomCode`, `isMyCode`, `shareUrl`. Replaces the per-game copies of `joincodes.ts` that differed only in `GAME_ID`. |
| `manifest.json` | The shared roster, and the source of truth: `play` (`npm run sync`) and `cast` (`npm run sync`) build from this file. Edit it here, run `npm run sync` in `play` and `cast`, and `node kits/scripts/sync-roster.mjs --check` tells you if `play/public/manifest.json` has fallen behind. |
| `join-codes.test.ts` | Vitest. Includes the typo-catching and capacity numbers quoted below. |

## Using it in a game

```ts
// game-config.ts
import { makeRoster } from '@game/engine/src/kit/join-codes/roster';
export const ROSTER = makeRoster('my-game');          // my-game must be in manifest.json
```
Server: `ROSTER.randomCode(cryptoRng)` when creating a room. Client: `ROSTER.isMyCode(text)` for the entry screen and the `?room=` link, `ROSTER.shareUrl(code)` for the QR.

## Adding a game
1. Give it first letters in the manifest (`kits/join-codes/engine/manifest.json`) (use `status: "reserved"` to hold letters before the game is ready). **All 24 letters are currently assigned (8 each), so a new game means taking letters from an existing game's block.** Codes of the game that loses a letter stop validating if they start with that letter, so only take letters when no live room uses them (rooms are short-lived, idle rooms close after 30 minutes).
2. Run `npm run sync` in `play` and in `cast`, and redeploy both. Redeploy any live game whose block changed: each game carries a copy of the roster and checks its own codes against it.
3. Until the game is registered, `makeRoster('id', { own })` lets it run with its own entry; its letters take precedence in that copy only.
4. Never let a game mint a code outside its own letters, or two games will claim the same code.

## How many games fit?
Rooms a game can have open at the same time (its code space):

| Layout | With check letter | Without |
|---|---|---|
| 1 first letter per game (24 games max) | 576 | 13,824 |
| 2 letters per game (12 games) | 1,152 | 27,648 |
| 8 letters per game (3 games, today) | 4,608 | 110,592 |

Rules of thumb: keep live rooms under about 10% of a game's code space (so a new code is found in about one try, and random guesses rarely hit a live room). With the check letter, one letter per game means roughly 55 comfortable simultaneous rooms per game, 576 hard ceiling. Without it, about 1,300 comfortable.
If the roster ever outgrows 24 games, move to a 2-letter prefix (576 prefixes) or a 5th letter; the manifest/validate shape does not change.

## Measured (see the test)
- Every single wrong letter in positions 2-4 of a checksum code is rejected. A wrong first letter is rejected or re-routed to another game.
- Swapping two adjacent letters is caught about 86% of the time (weights cannot be perfect with a base of 24).
