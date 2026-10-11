# Kit behaviour decisions (Tanner, 2026-10-10)

These are the rules the kits must match. Status: recorded, NOT yet implemented in the packages unless noted.

| Topic | Decision | Change needed in kits |
|---|---|---|
| TV lobby content | Code, QR, player names **plus avatars** | Kit already shows avatars. Live games (names only) gain avatars when migrated. |
| Games adopting avatars | Yes, all three games adopt avatars at migration (visible change) | Chameleon, Track Record, Sandwich Slam migrations |
| TV buttons | No Leave / Close buttons on the TV. Fullscreen only in a plain browser (hides top bar); a cast TV is fullscreen automatically | Remove Leave/Close from TV; keep Fullscreen browser-only |
| Controls / settings | Host phone only; TV has no settings or blocking controls | Check TV screens for any controls |
| "Use as host screen" button | KEEP (explicitly wanted) | None; it stays in the entry screen |
| Cast button | Stays on host device and host screen, hidden on the receiver | None |
| Cast failure | Keep the button; on failure show a clear message with the join/TV link and QR so the TV's browser can open it, or use "Use as host screen" | New: failure fallback in `cast` |
| Music | Casting TV plays it; if not casting, the host phone plays it | Check `audio`/`cast` precedence |
| TV advance (not cast) | Host phone drives the TV | Verify the TV never needs a click |
| Joining | All four: scan QR, type code at play.0801564.xyz, host-shared link, game URL + code | Add host "share link" if missing |
| Disconnect | Bot takes over after a timeout, player can take the seat back | `bots-away` behaviour check |
| Starter game | Minimal working game: lobby, TV, host phone, one trivial round, results | Already close; verify |
| Sandwich Slam | Migrate last, onto the shared room protocol | Phase 2c |
| Publishing | Public npm (`@gizmo564`), review first: scan for private info/secrets, add license, user approves before publish | Pending |

Open: real Chromecast test pass; why casting failed on a friend's network (unknown, unverified).
