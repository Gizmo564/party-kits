/// <reference types="@cloudflare/workers-types" />
import { handleGameRequest, type RoomEnv } from '@gizmo564/room-server/server';
import { ROSTER } from '@game/engine';

export { RoomDO } from './room';
export { IndexDO } from '@gizmo564/platform/server/party-admin';

export default {
  fetch: (req: Request, env: RoomEnv, ctx: ExecutionContext) => handleGameRequest(req, env, ctx, { roster: ROSTER }),
} satisfies ExportedHandler<RoomEnv>;
