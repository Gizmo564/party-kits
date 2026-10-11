# Phase 2 Build Plan: move Sandwich Slam onto the shared kit room

Status: DRAFT for Tanner's approval. Nothing here has been built. Written 2026-10-11.
Answers already given: bots stay a game feature ("keep its bots as they are"); same approach as Chameleon and Track Record; migrate last.

## What I found (read from sandwich-slam-xyz on 2026-10-11; not yet compiled or run against the kit)
- Server: `packages/engine/src/online.ts` (575 lines) holds pure room logic (RoomData, join, disconnect, act, tick, viewFor, maskGame); `packages/worker/src/worker.ts` (272 lines) holds the Worker routes plus `RoomDO` with its own alarm, idle close, Nap Guard and stats.
- Two modes in one room: **Classic** (turn-based, optional bots) and **Overstuffed/Blitz** (real-time: plays carry `bplay`/`bcycle`, a 3.5 s countdown, a 90 s rules gate with a ready list, 15 s round breaks, 45 s idle stalemate, bot "think" timers).
- Bots are room members (`addBot`/`removeBot`, level easy/medium/hard); an absent human gets a bot after 25 s (`AWAY_GRACE_MS`).
- Web: `net.ts`, `Online.tsx`, own `cast/sender.ts`, Fullscreen, TV display; game screens `Game.tsx`, `Overstuffed.tsx`, `Hand.tsx`, `Pile.tsx`.
- Max 8 humans (`ROOM_MAX_HUMANS`), up to 16 colors.

## Likely kit gaps (to confirm in stage 0, by prototype, before committing to the design)
1. **Real-time actions:** the kit's `act` may assume one seat acts at a time. Blitz needs any seat to act at any moment. Needs a check of `BaseRoom.act` ordering rules.
2. **Timers at sub-second resolution:** Blitz countdown, bot think times, 45 s stalemate. The kit has `tick`/alarms; precision and cost under hibernation are unverified.
3. **Lobby bots as seats** (add/remove bot, level). `botsAway` only covers absent humans. May need a small kit addition (`lobbyBots`) or keep it in Sandwich's logic via lobby settings.
4. **Mode switch and per-mode settings** (Classic vs Blitz), and the ready gate; Track Record's "cue" gate is a precedent.
5. **Color picker** per member (`color` message); the kit assigns colors from a palette today.

## Proposed stages (branch `kits-migration` in sandwich-slam-xyz; kit changes on a party-kits branch)
0. **Prototype (no behaviour change):** a throwaway `SandwichLogic` that only does Classic turns and lobby, to answer gaps 1 to 5 and write the findings here. Go/no-go with Tanner if a gap needs a big kit change.
1. **Kit additions** (only what stage 0 proves is needed), with tests in party-kits.
2. **Server:** `sandwichLogic` on `GameRoomDO`; keep the engine (`game.ts`, `bots.ts`, `blitz/*`) unchanged; keep the `RoomDO` class name and migration tag. Port `online.test.ts` as the spec (231 lines); add a scripted protocol run like Track Record's (34 checks).
3. **Web:** `room-client`, kit lobby (code, QR, names, avatars, host controls, no Leave/Close on the TV, Fullscreen only in a plain browser), kit cast (keeps the iPhone bridge), adapter `net.ts` so game screens stay unchanged. Own game screens stay.
4. **Checks before any deploy:** typecheck, all tests, build, `wrangler deploy --dry-run`, local `wrangler dev` with a TV plus phones in Chromium for Classic and Blitz, screenshots, then you try it on devices. Deploy only after you say so (or after the pass-the-checks go-ahead you gave for Track Record, if you repeat it).

## Behaviour changes to expect (to confirm at approval)
- Same visible changes as the other games: avatars on the TV lobby, no Leave on the TV, Fullscreen only in a plain browser, "Make host"/"Remove" buttons, 3-minute close for empty rooms, End game for everyone.
- Rooms in progress end at deploy and everyone rejoins (new tokens), as with Chameleon and Track Record.
- Away humans: bot takeover after 25 s is kept (you chose to keep Sandwich's bots). Exact timing may shift by up to one tick; unverified.

## Not verified / risks
- Blitz real-time feel under the kit's tick model is the main risk (gaps 1 and 2); stage 0 exists to find out early.
- Real Chromecast, real music/sound on a TV, and the iPhone app bridge cannot be checked here.

## Questions for Tanner
1. Approve stages 0 to 4, or stage 0 only for now (a prototype and a written verdict)? Recommended: stage 0 first.
2. Blitz timing: if the kit can't match it exactly, OK to accept up to about 0.25 s of timing drift on countdowns and bot think times, or must it be identical?
3. Is the 8-human limit and the color picker to be kept exactly as is?
4. Deploy: ask each time, or deploy on passing checks like Track Record?
