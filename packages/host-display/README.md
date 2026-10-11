# host-display

A **host display** is a TV or laptop that joins a room as a spectator and shows the shared game. It never takes a seat. Always optional: a room with no display plays exactly as it does without one.

## Player flows
- **Phone first:** host makes a room on the phone; on the TV choose "Join as the host display" and type the code (`?room=CODE&role=display`).
- **TV first:** the TV opens a room; the first phone to join becomes the host (as in Track Record and Chameleon). If the host leaves and nobody can take over, the next person in taps "Take control: be the host" (`claimHost`).

## The contract (implemented and tested in `room-server/server/base-room.ts`)
1. A display joins with `screen: true`: no seat, never the host, a spectator for gameplay.
2. It gets the same masked view as any spectator (`viewer = null`). Never build a second "display view".
3. The first player to join a room is its host, TV-first rooms included; a screen or spectator never is. `claimHost` only works while nobody hosts. The host's Leave button sends `{type:'leave'}`: host (and the music, unless a TV plays it) passes to the next connected player.
4. Exactly one device plays music (`you.music`). A connected display takes it, the casting TV (`hello.cast`, set by the Chromecast receiver) outranks any other display, and the host's phone gets it back only if no display is connected. Use `useMusicDevice(audio, snap.you.music)` from the audio kit, and create the audio kit with `tryAtStart: true` so a TV needs no tap.
5. A display is not a player: not in the player list, not in "ready" counts, not in stats (`GameRoomDO` skips `player_joined` for screens), and its disconnect never marks anyone away.
6. A display can join mid-game.
7. **A display never waits on a button.** Whatever needs a tap on a phone must advance by itself on a screen, or be driven by the host's phone, or wait for the players' ready confirmations. "Show on TV" (`cast` kit) appears on the host's device and on the display.

## Pieces
- `Stage`: lay the table out once at 1280x720 and scale it to the window. Without it a TV shows a tiny phone layout.
- `DisplayShell`: header with code, QR, Full screen (fullscreen needs a tap and does not exist in iPhone Safari; the button hides itself there).
- Lobby for a display: `lobby-host`'s `LobbyScreen` already shows the big code and QR when `you.screen`.
- In-game view for a display: render your normal table component with a `spectator` prop (no hand, no inputs, every event animated, a turn banner instead of a hand).

## Gotchas
- `vite build` empties `dist`; restart `wrangler dev` after each build or assets 404.
- A display opened first must not become host: BaseRoom only makes the first non-screen member host.
- Casting/AirPlay of an arbitrary browser tab cannot be triggered by a web page; a browser on the TV, or the cast kit (Google Cast receiver), is the portable answer.
- Retired: the Firebase `displayUid` driver is in `kits/legacy/host-display-firestore/`.
