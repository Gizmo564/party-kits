# realtime

For games where any player can act at any moment (not one turn at a time), such as Sandwich Slam's Overstuffed.

```ts
// server: RoomDO config
protected readonly cfg = { logic, site: 'my-game', plugins: () => [botsRealtime(logic, { plan })] };

// the game's brain: what should this seat do, and how long does it think first? null = nothing until the state changes
const plan = (state, seatId, ctx, away) => ({ action: { type: 'play', card: 7 }, afterMs: 600 });
```

Use `@gizmo564/bots-away` for turn-based games and this package for real-time ones. Both give the same lobby `bot` message, `away` flags and host handoff (they share that code). The difference is the timers:

- turn-based (`bots-away`): every automatic seat's timer restarts whenever the game state changes. Fine when one seat moves at a time. In a real-time game humans move constantly, so the bots would never play (there is a test showing exactly this).
- real-time (this package): each bot, and each human who has been away past the grace period (25 s), keeps its own plan `{ action, at }`. Other players' moves do not touch it. If the plan is no longer legal when its time comes, the game's `act` refuses it and the seat re-plans after 300 ms; after 3 refusals in a row it sleeps until the state changes (no alarm loop).

Plans are saved with the room, so they survive hibernation and the Nap Guard (`shift`). One automatic move happens per tick, so each move's events reach clients as their own snapshot.

Game side, the usual real-time rules still apply: the game's `act` must check timing itself using `ctx.now` (for example refuse plays before a countdown ends) and expose its next phase change through `deadline`/`tick`.

Not covered here: very fast human input is not rate-limited by the kit; each action is one save and one broadcast.
