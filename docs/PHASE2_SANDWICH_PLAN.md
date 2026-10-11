# Phase 2 Build Plan: move Sandwich Slam onto the shared kit room

Status: BUILT on branch `kits-migration` of sandwich-slam-xyz (see RESULT at the end). Plan approved by Tanner 2026-10-11, all stages. Written 2026-10-11.
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


---
## RESULT (2026-10-11, branch `kits-migration` in sandwich-slam-xyz)

Answers Tanner gave: all stages approved; Overstuffed is real time and must stay real time ("perhaps a real-time kit is needed"); bot think times may drift, countdowns must not; max 16 players; deploy when needed; keep Sandwich's bots; license MIT.

### Kit work this needed (party-kits)
- **New package `@gizmo564/realtime`** (`botsRealtime`): bots and away players for real-time games. Every automatic seat keeps its OWN plan {action, at}. The turn-based plugin restarts all bot timers on every state change, so with a human acting every 100 ms the bots never play (a test shows this). Plans survive hibernation and the Nap Guard; a plan may say "ask me again in N ms" (`recheckMs`) without acting; a refused plan is re-planned after 300 ms and a seat sleeps after 3 refusals in a row.
- `bots-away`: shares `lobbyBotMessage` and `flagAwayAndHandoff` with realtime; new options `botExtraMs(state)` (extra bot pause, used for the close/swipe animations) and `enabled(state)` (sit out a mode another plugin runs).
- **Bug fixed in `bots-away` (affects Track Record and Chameleon, which are NOT redeployed yet):** when the host was away and nobody else was connected, `nextWake` kept returning a time in the past, so the Durable Object re-armed its alarm every 50 ms until the room closed (up to 3 minutes). It now only asks for the handoff wake-up when a connected human exists.
- Findings that needed no kit change: `GameLogic.act` already takes any seat at any moment (real time works), `deadline`/`tick` carry the gate/countdown/break/stalemate timers, `palette` carries the 16 colors, `Seat.data` carries the bot level.

### Sandwich Slam
- `packages/worker/src/logic.ts` (`sandwichLogic`): Classic + OVERSTUFFED in one room; the engine is unchanged. Raw step events are never broadcast (they would show every hand); the view carries them masked per viewer, with its own `evSeq` so an animation plays once.
- `room-do.ts`: `GameRoomDO` + `botsAway` (Classic) + `botsRealtime` (Overstuffed). `RoomDO` keeps its name; the DO binding is now `ROOMS` (binding name only; class and migrations unchanged).
- Web: `net.ts` adapts the kit snapshot to the RoomView the screens already read; kit `cast`, `Fullscreen`, `room-client`; own cast files, FullscreenButton and token code deleted; "Make host"/"Remove" in the lobby; no Close/Menu/Leave on the TV; all 16 colors; TV "Show on TV" fallback link + QR.
- Tests: 62 engine, 16 server (`room.test.ts`, replaces the old online tests and adds real-time bot checks), 17 web; a scripted run against a local Worker (27 checks): Classic with a bot, rejoin, masked views, End game, a full OVERSTUFFED game vs 3 hard bots while the human acts every 300 ms, play again, bad input. UI run in Chromium (TV + phones): lobby, Make host/Remove, Classic table, Overstuffed popup and table, no page errors.

### Behaviour differences from the live game
1. Same as the other games: no Leave/Close/Menu on the TV, Fullscreen only in a plain browser, empty rooms close after 3 minutes, End game for everyone, everyone rejoins after the deploy (new tokens) and rooms running at deploy end.
2. Up to 16 players (was 8 humans); OVERSTUFFED still refuses more than 8 (engine rule).
3. Players who are disconnected at game start are seated (before: dropped from the game).
4. Late joiners watch as spectators (before: refused).
5. A player who leaves the OVERSTUFFED rules popup or the break no longer unblocks it at once: they are readied after the 25 s away period (the popup also times out at 90 s).
6. OVERSTUFFED bot pacing is approximate: bots keep the old think times and "0.8 / 0.4 / 0.5 x think" look-again factors, but a refused (stale) play re-plans after 300 ms instead of 0.5 x think, and bots no longer speed up when someone else plays. A fumble is now planned (the bot looks again later) rather than decided at the moment of the play.
7. Classic bot animation pauses (+1.6 s after a closed sandwich, +0.9 s after a swipe) are kept through `botExtraMs`.
8. Browser token storage is per browser (kit, localStorage), no longer per tab: two tabs of one browser are now one player.
9. Avatars stay the letter circles; the kit's face avatars are not used in Sandwich Slam.

### Not verified
Real music/sound on a TV, a real Chromecast, the iPhone app bridge (kit unit tests only), the live admin counts, phone layouts beyond the screenshots, play feel of OVERSTUFFED bots against the old build (only that they play whole games), and how the old room storage behaves when the new Durable Object first loads an old room (rooms end at deploy; the same assumption held for the other two games).
