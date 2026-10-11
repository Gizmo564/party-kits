# Phase 3 – Stage 1: differences between game copies and the kits

Read from the code on 2026-10-11 (kit 0.1.1 vs the three games' `main`). Nothing here is changed yet.
"Unverified" = I did not read or run it.

## Findings that change the plan
- Trailer strip done first: main (and Track Record's two branches) force-pushed in track-record-xyz, chameleon-xyz, sandwich-slam-xyz. 0 Claude trailers remain on GitHub; file contents identical. Local bundle backups: ~/0801564-site/_backups/*-before-strip.bundle.
- Chameleon and Sandwich ALREADY use the kit roster/join-codes (4-line and 10-line wrappers). Track Record's `engine/roster.ts` is a different thing (players -> units, colours), game-specific. So "roster" is NOT a leftover copy. Nothing to move.
- Sandwich `fit.ts` is not a copy of the kit `fit.ts` (it is a window-scaling hook and a hash helper). Not a leftover.
- Kit components emit class names (page, panel, btn accent, row between, chip, player-row...). Track Record's CSS defines them (the kit came from it). Chameleon's CSS uses a different set (app-shell, btn green, stack lg, panel stack sm); Sandwich uses btn primary, felt. (Whether the missing classes are defined is unverified: needs a CSS check.) Adopting kit lobby/pass/results shells in those games needs small CSS mapping inside the game, or the kit would look unstyled.

## Table (decide per row: KEEP-GAME / USE-KIT / MERGE)
| # | Piece | Games | What differs | My suggestion |
|---|---|---|---|---|
| 1 | Credits | TR, Chameleon, Sandwich | Same markup. Kit takes music/extra/creator/note as data. Games add `open={isCastReceiver()}` (credits open on the TV); kit has no `open`. | USE-KIT; add `open` prop to kit; games keep their music lists as data. Low risk. |
| 2 | fitCards vs fitGrid | TR | Same code, different name. | USE-KIT (rename import). Zero visible change. |
| 3 | Rng | TR, Sandwich | Same algorithm (kit adds between/pick/newSeed/forkRng). Seeded games replay the same. | USE-KIT. Verify with the engine tests. Low risk. |
| 4 | accountName | TR, Chameleon | Kit: same fetch, max default 14 (Chameleon passes 20; kit also trims before cut, game after: tiny edge case). | USE-KIT. |
| 5 | Tutorial | TR | Kit lacks the progress dots, the `tour-back`/`tour` classes, and TR uses `sfx('tap')` (kit has a `sound` callback). Storage key stays `tr-tour-done` if game id is `tr`. | MERGE: add dots + class hooks to kit; TR keeps its steps. |
| 6 | Rules page | TR, Sandwich, Chameleon HowTo | Kit has only a modal (RulesModal/RulesButton). All three games use a full page with a Back button; TR has a "show quick tour again" button; Sandwich has a card table + gallery; Chameleon has an icon. The text is game-specific. | MERGE: add a `RulesPage` frame (title, back, sections, footer slot) to kit; rules text stays in each game. Honest value is small (just the frame). Your call whether it is worth it. |
| 7 | TurnTimer | Chameleon | Different props (endsAt/totalSeconds/offset vs deadline/total/skewMs), different look (inline colours/fonts vs CSS classes), 100ms vs 200ms tick. Chameleon is the only user. | MERGE: kit gets colour/size options and Chameleon passes its look, or KEEP-GAME. Visible-change risk: medium. |
| 8 | Pass cover | Sandwich | Kit PassCover almost equal. Differences: heading "Pass to X" vs "Pass the phone to X", extra "Hands stay hidden until X taps" line, button text "show my hand" vs "show my turn", avatar 120 vs 96, test ids differ. Kit PassGate also re-covers when the tab hides or after idle (Sandwich: unverified whether it has this). | MERGE: kit gets text/size props (defaults unchanged); consider adopting PassGate re-cover (behaviour change: you decide). |
| 9 | Pass and Play | Chameleon | 232-line local flow (setup, pass, peek, talk, vote, guess, result). Only the "pass" cover step overlaps with the kit. I read only the first 80 lines (rest unverified). | USE-KIT only for the cover step; flow stays in the game. |
| 10 | Results / end screens | TR End, Sandwich End (Chameleon final: unverified) | Kit ResultsScreen = ranked list + headline + Play again/Leave + credits + End-for-everyone. Games add a trophy + winner timeline (TR), every-sandwich piles + inspector (Sandwich), a Menu button, a custom "Play again" label, a disabled "Waiting for the host..." button. | MERGE: use kit `rankRows`/`Scoreboard` + buttons, add `againLabel`, `onMenu`, children slot (already exists). Game-specific content stays. |
| 11 | Lobby (online) | TR, Chameleon | Kit LobbyScreen: code panel, QR, host claim, player list with kick/make host, profile editor, schema-driven settings, Start with reason, and a TV mode. TR is very close (teams toggle, presets and deck-loading gate are game-specific). Chameleon's lobby uses a different class vocabulary and extras (custom words, music-where picker). | TR: USE-KIT as a shell, keep GameSettings/teams via `children`/`blockReason`. Chameleon: USE-KIT shell + `sections` for its settings, plus CSS mapping (see above). |
| 12 | TV display | Sandwich | Sandwich Display has its own lobby grid; kit has DisplayShell (room code + QR + Full screen) and Stage. Sandwich also shows a Music + Cast + Full screen button row. | MERGE: DisplayShell `right` slot already fits. Moderate change in layout. |
| 13 | Audio | Chameleon, Sandwich | Chameleon: files in `/audio/*.mp3` (via BASE_URL), mute key `chameleon_muted` (kit would use `chameleon-muted`, resetting each person's choice), volume 0.45, stings + chain to credits. Sandwich: files bundled by Vite glob from repo-root `/sounds`, mute key `ss-muted` (matches kit if game id is `ss`), volume 0.5, SFX files for cards. Kit loads `/sounds/<name>.mp3` by URL probing. | MERGE: kit gets `mutedKey`, `baseUrl`, and a `urls` map (for bundled files) so existing files and mute settings stay exactly. Track Record: untouched. |
| 14 | Qr | Chameleon (own Qr.jsx), Sandwich (own, kept on purpose) | Kit Qr exists. | Chameleon: USE-KIT. Sandwich: KEEP-GAME (as before) unless you say otherwise. |
| 15 | Mute button | Chameleon MuteButton (round icon), Sandwich MusicButton (text) | Kit MusicButton is the Sandwich text style. | Sandwich: USE-KIT (same look). Chameleon: KEEP-GAME look, wired to kit audio. |

## Not moving (not shared pieces)
Track Record audio dir; Track Record `roster.ts`; Sandwich `fit.ts`, Avatar letter circles, Overstuffed/Pile/Hand/Inspector/Game; Chameleon Round/Room/HostOnline gameplay; all `styles.css`/`game.css`.

## Unverified
Whether Chameleon/Sandwich CSS defines the kit's class names; PassPlay lines 80+; Chameleon final screen; whether Sandwich's pass screen has idle re-cover; unused-dependency list.
