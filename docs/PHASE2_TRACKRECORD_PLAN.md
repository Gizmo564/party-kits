# Phase 2b: Track Record onto the kit packages

Status (2026-10-10): built and tested on branch `kits-migration` in track-record-xyz (2 commits). NOT merged, NOT pushed, NOT deployed.
Approved by Tanner: same approach as Chameleon; keep the current music rules; no bots (a player who is away loses their turn); teams become a kit feature; end rooms in progress at deploy.

## What was built
- **Kits (new, all backward compatible):** `engine-core` teams helpers; `lobby-ui` TeamPicker/TeamChip; room hooks `GameLogic.view(state, viewer, who)` (per-device view: the music device gets the song), `initialProfile`, `palette`, `startEvents`, `systemAction`, `ActContext.musicId`, `RoomConfig.startContext` (loads the song list at start); `cast` now speaks to the iPhone player app's native bridge (it was only in Track Record's copy).
- **Server:** `trackRecordLogic` on the kit's `GameRoomDO` (ready gate, steal buzzer + 12 s window, teams, co-op, away skip). Engine unchanged except a new free `pass` action. Old room/join code/nap/stats/admin copies deleted.
- **Web:** kit `room-client`, `cast` (with the TV link fallback), `FullscreenButton`, `TeamPicker/TeamChip`; flat-snapshot adapter in `net.ts`, so screens and CSS are unchanged.

## Checked
Typecheck, 58 engine + 26 server + 8 web tests, build and `wrangler deploy --dry-run` on the Mac. A real local Worker run: 34 protocol checks (TV + 3 phones, steals, 12 s timer, away skip, play again, End game for everyone frees the code, teams, bad input) and a Chromium run with a TV + 4 phones (lobby, teams picker, draw, ready gate, turn).

## Behaviour differences from the live game (check before deploying)
1. TV: no Leave button, no Menu during the game, no Menu on the results screen; Fullscreen only in a plain browser.
2. A player who has been disconnected for about 25 s is marked away and their turn is passed (free, their cards stay); if their turn is already revealed it moves on. Before, the game waited for them. No bots.
3. A host who is away for 25 s hands hosting to a connected player (kit behaviour; before, only the Leave button did).
4. The old "host who is a spectator" mode (hello with spectate and no screen) is gone. "Use as host screen" is unchanged (it is a screen).
5. A TV (screen) still cannot report an unplayable song; only a player device can (same as before; not fixed).
6. Settings are validated on the server (unknown keys dropped, wrong types refused); before anything was accepted.
7. Team buttons use the kit's team colours (selected button is team-coloured).
8. Saved player tokens are new, so everyone rejoins as new after the deploy; rooms running at deploy end.
9. Rooms with nobody connected close after 3 minutes; the host's End game for everyone closes the room (it already did).
10. UPDATE: the kit lobby "Make host" and "Remove" buttons are now in Track Record's lobby (host only, on a non-TV device).

## Not verified
Real music playback (Deezer) on a TV and phone; a real Chromecast and the cast failure message; the iPhone app bridge (unit-tested in the kit only); admin counts; phone layouts beyond the screenshots; tablet/TV at other sizes.
Track Record still uses its own avatars/Qr/Modal copies (not swapped to the kit's).
Chameleon's package-lock holds the old tarball hashes: reinstalling Chameleon needs its lock refreshed (the local tarballs were repacked).
