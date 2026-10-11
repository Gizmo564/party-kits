// The Durable Object: one per room code. GameRoomDO does the websockets, saving, timers, idle close, Nap Guard and stats.
import { GameRoomDO, type RoomConfig, type RoomEnv } from '@gizmo564/room-server/server';
import { botsAway } from '@gizmo564/bots-away/server';
import { luckyLogic } from './logic';

export class RoomDO extends GameRoomDO<RoomEnv> {
  protected readonly cfg: RoomConfig = {
    logic: luckyLogic,
    site: '__SLUG__',                       // must exist in landing/src/stats-core.js SITES (checklist section 2)
    plugins: () => [botsAway(luckyLogic)],  // host-managed bots + a 25 s away-player takeover
  };
}
