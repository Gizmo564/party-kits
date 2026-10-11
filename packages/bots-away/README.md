# bots-away

```ts
// server: RoomDO config
protected readonly cfg = { logic, site: 'my-game', plugins: () => [botsAway(logic)] };
// engine: implement the brains (both optional; a game with neither just never auto-plays)
botAct(state, seatId, ctx)  -> Action | null     // bot seat; null = nothing to do until the state changes
awayAct(state, seatId, ctx) -> Action | null     // disconnected human; defaults to botAct (a bot of "medium" strength)
```
Client sends `{type:'bot', op:'add'|'remove', id?, level?}` (host, lobby only). Members carry `bot` / `away` flags in every snapshot; `plugins.botsAway.graceMs` tells the UI the grace period.

Behaviour (from Sandwich Slam): a bot waits 1.4 s after the last state change before moving (so the table animation can play); a human who has been disconnected 25 s is flagged `away` and the game's `awayAct` plays for them until they reconnect with their token; the host role moves to the longest-present connected human after 25 s of host absence. One automatic move per tick; a seat with nothing to do sleeps until the state changes, so an idle bot never burns alarms.
Tune with `botsAway(logic, { awayGraceMs, botThinkMs, maxBots, hostHandoff })`.
