# Phase 3 – Move leftover game copies into the kits (BUILD PLAN – awaiting approval)

Status: DRAFT. Nothing below is built. Facts marked (unverified) have not been checked against code yet.

## Principles (from Tanner)
- Kits hold only COMMON, SHARED pieces. Games keep their own gameplay, rules logic and look.
- Goal: fix a bug once, update all games via the npm kit versions (Renovate groups kit updates).
- When a copy differs from the kit, who wins is decided game by game and feature by feature (NOT "kit always wins"). Each difference is listed in Stage 1 and Tanner decides; the kit may be improved (0.1.2) or the game may keep its variant via props/slots.
- Each game keeps its own look (styles.css / game.css). The themes kit is a shelf of already-made themes for future games, not something games must track for consistent updates; it is not part of this phase.
- Chameleon HowTo.tsx moves to the kit rules screen as well (approved), subject to the Stage 1 diff review.
- Track Record's lobby shell is in scope (shell only).
- Track Record audio stays exactly as is (it is an audio-based game). Chameleon/Sandwich may move to kit audio only if every existing uploaded sound/music asset is kept and sounds the same.
- All three games on branches, deployed together after approval. Commits authored "Team Rocket", no Claude trailers. No npm publish without approval.

## Scope (approved)
| Area | Kit | Game files in play |
|---|---|---|
| Credits | rules-results | TR Credits.tsx, Chameleon Credits.tsx, Sandwich Credits.tsx |
| Rules / Tutorial | rules-results | TR Rules.tsx + Tutorial.tsx, Sandwich Rules.tsx, Chameleon HowTo.tsx (check fit) |
| Results / scoreboard | rules-results | per-game end screens (Sandwich End.tsx, etc.) – only the shared scoreboard/ranking part |
| TurnTimer | lobby-ui | Chameleon TurnTimer.tsx |
| fit.ts | lobby-ui | TR fit.ts, Sandwich fit.ts |
| Pass the phone | pass-the-phone | Chameleon PassPlay.tsx, Sandwich Pass.tsx |
| Lobby / TV display shell | lobby-host, host-display | Chameleon Lobby/HostOnline/Room, Sandwich Display/Online, TR Lobby (shell only) |
| Audio (Chameleon, Sandwich only) | audio (expanded) | Chameleon Music.tsx, Sandwich useMusic/MusicButton/sfx |
| Small helpers | platform / join-codes / engine-core | account.ts, roster.ts, rng.ts |
| NOT moving | – | Track Record audio dir, Qr (Sandwich, deliberate), Sandwich letter-circle Avatar, all gameplay screens, game CSS |

## Stages
0. Baseline: for each game, record before-screenshots (lobby, TV display, rules, credits, end) and `tsc`/build result.
1. Diff pass: for every in-scope file, list differences vs kit. Present as a table; "kit wins" unless the game's version has behavior the game needs.
2. Kit improvements (party-kits branch): add needed options (e.g. branding/title props, hide-on-cast `cast=1`, audio expansion: load existing Chameleon/Sandwich clips and music via kit API with identical assets). Bump to 0.1.2 – NOT published until you approve.
3. Per-game migration on a branch (Sandwich, Chameleon, Track Record): replace copies with kit imports, delete dead files, remove unused deps, build + typecheck.
4. Verify: after-screenshots vs baseline, check audio assets are byte-identical and referenced, headless checks of lobby/TV/rules/credits. Cannot verify real Chromecast or live multiplayer without you.
5. Review: you see diffs/screenshots; on approval I publish kits 0.1.2 (trusted publishing, run workflow), games bump to ^0.1.2, deploy all three together.

## Risks
- Audio expansion is the riskiest (Chameleon/Sandwich sound must not change). Mitigation: keep original asset files; compare outputs; TR untouched.
- Rules/Tutorial copies differ by 43-60 lines; kit may drop game-specific wording. Mitigation: props/slots in kit.
- Deploying three games together means one bad kit bug hits all; mitigated by staged verification and keeping previous deploy IDs for rollback.
- Rooms in progress end at deploy.

## Rollback
Each game is on its own branch; previous Cloudflare deployment IDs recorded before deploy; kit 0.1.1 stays on npm.

## Open items for Tanner
- Confirm plan, then say go. Anything unverified above will be checked in Stage 1.
