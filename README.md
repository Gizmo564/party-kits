# party-kits

The reusable pieces of the 0801564.xyz party games, as npm packages under the `@gizmo564` scope, plus `create-game`, the scaffold for a new game.

| Package | What it is |
|---|---|
| `@gizmo564/create-game` | `npx @gizmo564/create-game "My Game"`: a working starter game wired to all the packages |
| `engine-core` | pure helpers every game engine shares (seeded RNG, Result/Status, text cleaning, ids) |
| `join-codes` | 4-letter room codes with a check letter, and the shared roster of games |
| `platform` | glue to the rest of 0801564.xyz: Nap Guard client, signed admin calls, stats beacon, sign-in prefill |
| `room-server` | `BaseRoom`, `GameRoomDO` (Durable Object), Worker routes, protocol types |
| `room-client` | `useRoom` (websocket, rejoin, reconnect, nap) |
| `bots-away` | room plugin: bots and away-player takeover |
| `lobby-ui`, `lobby-host` | avatars, QR, controls; the online lobby and TV lobby, host panel |
| `host-display` | the TV display shell (scales a fixed design to any window) |
| `pass-the-phone` | one-device handover cover |
| `rules-results` | tutorial, rules modal, results screen, credits |
| `audio` | synth effects, music, unlock rules |
| `cast` | Google Cast sender and receiver pieces |
| `themes` | design tokens, house CSS, nine themes |

Packages ship TypeScript source. Your bundler (Vite) and Wrangler compile it. Each package has its own version number.

## Working here
    npm install
    npm run typecheck       # all packages
    npm test                # all package tests (jsdom opt-in per file)
    npm run verify          # + packs every package, makes a game with create-game --local, installs the tarballs, typechecks, tests and builds it
    npm run verify:e2e      # + wrangler dev and the WebSocket end-to-end check
    node scripts/verify.mjs --e2e --tv   # + the real-browser TV-screen check (CHROMIUM=/path if Playwright has no browser)

See `docs/HOW_A_FIX_REACHES_GAMES.md`, `docs/MIGRATING_A_GAME.md` and `docs/PUBLISHING.md`.

## Status
Phase 1 of the packaging plan (see the plan in the site folder's `kits/PACKAGES_BUILD_PLAN.md`). Nothing here is published yet and no live game uses these packages yet. The old copy-in `kits/` folder is frozen and stays as the reference until Chameleon has migrated.
