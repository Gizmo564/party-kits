# Phase 2 Build Plan: move Chameleon onto the kit packages

Status: DRAFT for Tanner's approval. Nothing here has been built. Written 2026-10-10.

## What I found (facts, read from the code on 2026-10-10)

- Chameleon's server `Room` (`packages/server/src/room.ts`, 392 lines) is its own class. It does NOT extend the kit's `BaseRoom`/`GameLogic`. Its message shapes (`hello`, `state`) look like the kit's, but its `Snapshot` has game fields at the top level (`phase`, `round`, `turn`, `reveal`, `outcome`...) where the kit puts them inside a `view` and `settings` generic. So this is a rewrite of the room around `GameLogic`, not an import swap.
- Its client has its own `net.ts`, `Lobby.tsx`, `Room.tsx`, `HostOnline.tsx`, a copy of the cast files, `TurnTimer`, `Music`, `Credits`, untyped JS audio/analytics files (FLAGS C1/C2).
- The copies of `nap.ts`, `cast/*`, `TurnTimer` are not byte-identical to the kits (the kits moved on after the games were copied), so even the leaf swaps change behaviour slightly (they add the cast fallback, hidden Fullscreen on a TV, etc.).
- The earlier plan said Chameleon was "already on the kit protocol". That was too optimistic; only the wire format is similar.

## Proposed stages (each on a branch `kits-migration`, nothing deployed)

1. **Leaf swaps** (low risk): join codes (`join-codes`), stats and Nap Guard (`platform`), cast (`cast`), TurnTimer/Credits/rules (`lobby-ui`, `rules-results`), theme CSS (`themes`). Chameleon's tests and a before/after screenshot check.
2. **Server onto `GameRoomDO` + `GameLogic`**: keep the engine (`@chameleon/engine`) unchanged; write a `ChameleonLogic` that adapts it (clue turns, voting, guessing, scoring). Keep the `RoomDO` class name and migration tag so live rooms are unaffected. The existing Chameleon room tests become the spec: they must pass unchanged against the new logic.
3. **Client onto `room-client`, `lobby-host`, `host-display`**: the kit lobby (code, QR, names + avatars, no Leave/Fullscreen on the TV), host panel, music rules, pass-the-phone stays Chameleon's own screen (its rules are game-specific).
4. **Checks before any deploy**: typecheck, all tests, build, `wrangler deploy --dry-run`, a local `wrangler dev` room with 3+ clients, `tv-check`, before/after screenshots of lobby/TV/results, and you try it on a phone and a TV.

## Visible changes you approved
Avatars on the TV lobby; no Leave/Close on the TV; Fullscreen only in a plain browser; bot takes over after a timeout (only if bots are turned on for Chameleon; Chameleon has none today, so this is optional).

## Risks
- Stage 2 changes the live server logic. Mitigation: the existing tests as the spec, a recorded websocket script from the old room replayed against the new one, and no deploy without your say-so.
- Time: stage 1 is small; stages 2 and 3 are the bulk.

## Questions for Tanner
1. Approve stages 1 to 4 as written, or only stage 1 for now?
2. Should Chameleon get bots/away takeover (it has none today)? Recommended: no, keep behaviour.
3. Existing rooms during a deploy: OK to let rooms in progress end when it deploys, as with earlier deploys?
