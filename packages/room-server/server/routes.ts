/// <reference types="@cloudflare/workers-types" />
// The Worker's front door, shared by every game. One call in worker.ts:
//
//   export default { fetch: (req, env, ctx) => handleGameRequest(req, env, ctx, { roster: ROSTER }) };
//
// Routes (identical in all three live games, plus the check-letter early reject):
//   GET  /api/nap              the guard's current answer (no-store)
//   POST /api/rooms            make a room -> { code }          (blocked when the guard says no-new / asleep)
//   GET  /api/rooms/XXXX       does this room exist? -> { exists, started, players, maxPlayers }
//   GET  /ws/XXXX              websocket into the room          (asleep: a 'nap' message, then close)
//   POST /api/admin/...        signed calls from the landing admin panel ("end all party games")
//   anything else              your `extra` routes, then static assets
import { handleAdmin, indexAdd } from '@gizmo564/platform/server/party-admin';
import { getNap, napMessage } from '@gizmo564/platform/server/nap';
import type { Roster } from '@gizmo564/join-codes/engine/roster';
import { cryptoRng } from '@gizmo564/join-codes/engine/roster';
import type { RoomEnv } from './room-do';
import type { ServerMsg } from './protocol';

export interface RouteOptions {
  roster: Roster;
  /** game-specific routes (an API proxy, a data file...). Return null to fall through to assets. */
  extra?: (req: Request, env: RoomEnv, ctx: ExecutionContext) => Promise<Response | null> | Response | null;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

const stubOf = (env: RoomEnv, code: string) => env.ROOMS.get(env.ROOMS.idFromName(code));

export async function handleGameRequest(req: Request, env: RoomEnv, ctx: ExecutionContext, opts: RouteOptions): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/api/nap') return json(await getNap(env), 200, { 'cache-control': 'no-store' });

  // Nap Guard: when the free daily limits are nearly used up, new rooms stop first, then everything pauses until the daily reset
  if (path.startsWith('/api/rooms') || path.startsWith('/ws/')) {
    const nap = await getNap(env, Date.now(), (p) => ctx.waitUntil(p));
    if (nap.level === 'asleep' && path.startsWith('/ws/')) {
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ type: 'nap', resetAt: nap.resetAt } satisfies ServerMsg));
      pair[1].close(1000, 'napping');
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (nap.level !== 'open' && (nap.level === 'asleep' || (path === '/api/rooms' && req.method === 'POST'))) {
      return json({ error: napMessage(nap), napping: true, level: nap.level, resetAt: nap.resetAt }, 503);
    }
  }

  if (path === '/api/rooms' && req.method === 'POST') {
    for (let i = 0; i < 8; i++) {
      const code = opts.roster.randomCode(cryptoRng);
      const r = await stubOf(env, code).fetch('https://room/create', { method: 'POST', body: code });
      if (r.status === 200) { ctx.waitUntil(indexAdd(env, code)); return json({ code }); }
    }
    return json({ error: 'could not create a room, try again' }, 503);
  }

  // the landing admin panel's "end all party games" (signed calls only)
  const adm = await handleAdmin(req, env, (code) => stubOf(env, code).fetch('https://room/close', { method: 'POST' }));
  if (adm) return adm;

  const ws = path.match(/^\/ws\/([A-Za-z]{4})$/);
  if (ws) {
    const code = ws[1].toUpperCase();
    // a mistyped or foreign code never wakes a Durable Object
    if (!opts.roster.isMyCode(code)) return json({ error: 'no such room' }, 404);
    return stubOf(env, code).fetch(new Request(`https://room/ws?code=${code}`, req));
  }
  const ex = path.match(/^\/api\/rooms\/([A-Za-z]{4})$/);
  if (ex) {
    const code = ex[1].toUpperCase();
    if (!opts.roster.isMyCode(code)) return json({ exists: false }, 404);
    return stubOf(env, code).fetch('https://room/info');
  }

  const extra = await opts.extra?.(req, env, ctx);
  if (extra) return extra;
  return env.ASSETS.fetch(req);
}
