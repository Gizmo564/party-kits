# cast

Google Cast ("Show on TV"): the host's Chrome sends `{type:'load', game, code}` to the shared receiver at cast.0801564.xyz, which checks it against
the roster (`resolveLoad`) and frames the game's own display page (`?room=CODE&role=display&cast=1`). The TV plays the music itself; no tab mirroring.
Same in Track Record, Sandwich Slam and Chameleon as of 2026-10-10 (the three casting commits of that day).

## Rules every game follows (and the starter game does)
1. **The button is on the host's device and on the host screen.** `<CastButton>` for `you.host || you.screen`, in the lobby and again in the game
   (a header button on the host's phone, and in the `DisplayShell` header of a laptop display). Either one can start the cast.
2. **The TV never offers to cast to itself.** `CastButton` returns nothing when the page is on the Chromecast (`CrKey` in the user agent) or inside a
   frame (`onCastScreen()`).
3. **One device plays the music, and the casting TV wins.** The receiver's display page joins with `screen: true, cast: <isCastReceiver()>`
   (`useRoom` option `cast`). `BaseRoom` gives the music to a cast screen even if a laptop display had it, never gives it to a laptop
   display while a cast TV is connected, and hands it back to a cast TV first. Phones and the other screens call `useMusicDevice(audio, you.music)`
   and stay quiet. (Sandwich Slam does this client-side from a `casts` count; the result is the same: FLAGS D.)
4. **The TV needs no tap.** Create the audio kit with `tryAtStart: true` (it also unlocks on the first touch or key press). A Chromecast
   allows autoplay; other browsers stay silent until the first touch, which is why the host's phone is the fallback.
5. **A TV never waits on a button.** Anything the phones tap through must either advance by itself on a screen (Track Record's "Who goes first?"
   moves on after 2.8 s via `DrawStage auto`), or be driven by the host's phone, or wait for the players' own ready confirmations (pass the phone:
   each player taps ready). The starter game's TV only ever shows the table: rounds move on the server's timers, the host's phone starts and restarts.

## Files
- `web/sender.ts`: `CAST_APP_ID`, the caster (loads Google's sender script, session state, sends the room).
- `web/cast.ts`: re-exports the sender and adds `resolveLoad` (receiver side: live game + valid code only).
- `web/receiver.ts`: `isCastReceiver()`, `onCastScreen()`.
- `web/CastButton.tsx`: the button and the unsupported-browser note.
- The receiver app itself is `cast/src/receiver.ts` at the site root; it imports this kit (`../../kits/cast/web/cast`, `../../kits/join-codes/engine/*`).

## Per game
Pass your game's id (it must exist in the roster). Nothing else to change.
