/// <reference types="@cloudflare/workers-types" />
// One Durable Object per room code. Generic: the game supplies a `GameLogic` (and optional plugins) through `cfg`.
//
//   export class RoomDO extends GameRoomDO<Env> {
//     protected readonly cfg = { logic: myLogic, site: 'my-game', plugins: () => [botsAway(myLogic)] };
//   }
//
// Lifecycle it handles for you (the same in Track Record, Sandwich Slam and Chameleon today):
//   create -> websockets (hibernation: sockets survive, `serializeAttachment` remembers who each one is) -> per-viewer
//   snapshots -> one alarm that wakes for the next timer or the 30-minute idle close -> Nap Guard freeze -> admin close.
import { indexRemove, type AdminEnv } from '@gizmo564/platform/server/party-admin';
import { getNap } from '@gizmo564/platform/server/nap';
import { reporter, type StatsEnv } from '@gizmo564/platform/server/stats';
import { BaseRoom, type RoomData, type RoomPlugin } from './base-room';
import type { GameLogic } from './game-logic';
import type { ClientMsg, ServerMsg } from './protocol';

export interface RoomEnv extends AdminEnv, StatsEnv {
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Nap Guard: the shared usage guard on the landing Worker (defaults to https://0801564.xyz/api/nap) */
  NAP_URL?: string;
  NAP_TTL_MS?: string;
  /** test hook: shorten the idle timeout (milliseconds) */
  IDLE_MS?: string;
}

export interface RoomConfig {
  logic: GameLogic<any, any, any, any, any>;
  /** the site name stats are filed under; it must exist in landing/src/stats-core.js SITES */
  site: string;
  /** fresh plugin instances for one room (plugins hold per-room state, so never share them) */
  plugins?: () => RoomPlugin[];
}

export const IDLE_DEFAULT_MS = 30 * 60_000;
const ACT_SAVE_EVERY = 60_000; // persist the activity clock at most once a minute
const MAX_MESSAGE = 20_000;

interface Attach { conn: string; member?: string }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const idleMs = (env: RoomEnv) => Number(env.IDLE_MS) || IDLE_DEFAULT_MS;

export abstract class GameRoomDO<E extends RoomEnv = RoomEnv> implements DurableObject {
  protected abstract readonly cfg: RoomConfig;
  private room: BaseRoom | null = null;
  private lastAct = 0;      // last time anyone did something (in memory; persisted at most once a minute)
  private actSaved = 0;
  private napSince: number | null | undefined;

  constructor(protected ctx: DurableObjectState, protected env: E) {}

  private report(type: 'game_created' | 'player_joined' | 'round_finished', extra?: { n?: number; peak?: number }) {
    reporter(this.env, (p) => this.ctx.waitUntil(p), this.cfg.site)(type, extra);
  }
  private plugins(): RoomPlugin[] { return this.cfg.plugins?.() ?? []; }

  // ---------- activity + idle close ----------
  private async touch(force = false) {
    const now = Date.now();
    this.lastAct = now;
    if (force || now - this.actSaved >= ACT_SAVE_EVERY) { this.actSaved = now; await this.ctx.storage.put('lastAct', now); }
  }
  private async lastActivity(): Promise<number> {
    if (!this.lastAct) this.lastAct = (await this.ctx.storage.get<number>('lastAct')) ?? Date.now();
    return this.lastAct;
  }
  /** Tell everyone, close the sockets, wipe the room so the code can be used again. */
  private async closeIdle(reason: 'idle' | 'admin' = 'idle') {
    for (const w of this.ctx.getWebSockets()) {
      try { w.send(JSON.stringify({ type: 'closed', reason } satisfies ServerMsg)); w.close(1000, reason); } catch { /* already gone */ }
    }
    const code = await this.ctx.storage.get<string>('code');
    this.room = null; this.lastAct = 0; this.actSaved = 0; this.napSince = undefined;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    if (code) this.ctx.waitUntil(indexRemove(this.env, code));
  }

  // ---------- load / save ----------
  private async load(): Promise<BaseRoom | null> {
    if (this.room) return this.room;
    const data = await this.ctx.storage.get<RoomData<unknown, unknown>>('room');
    if (!data) return null;
    const r = BaseRoom.restore(data, this.cfg.logic, this.plugins());
    for (const w of this.ctx.getWebSockets()) {
      const a = w.deserializeAttachment() as Attach | null;
      if (a?.member) r.attach(a.conn, a.member);
    }
    this.room = r;
    return r;
  }
  private async save(room: BaseRoom) {
    await this.ctx.storage.put('room', room.toJSON());
    await this.schedule(room);
  }
  private async schedule(room: BaseRoom) {
    const idleAt = (await this.lastActivity()) + idleMs(this.env) + 1000;
    const wake = room.nextWake(Date.now());
    const at = wake != null ? Math.min(wake + 50, idleAt) : idleAt;
    await this.ctx.storage.setAlarm(Math.max(at, Date.now() + 50));
  }
  private broadcast(room: BaseRoom) {
    const kicked = room.takeKicked();
    for (const w of this.ctx.getWebSockets()) {
      const att = w.deserializeAttachment() as Attach | null;
      if (!att) continue;
      if (kicked.includes(att.conn)) {
        try { w.send(JSON.stringify({ type: 'closed', reason: 'kicked' } satisfies ServerMsg)); w.close(1000, 'kicked'); } catch { /* gone */ }
        continue;
      }
      const snap = room.snapshot(att.conn);
      if (snap) { try { w.send(JSON.stringify(snap)); } catch { /* socket gone */ } }
    }
  }

  // ---------- HTTP (from the Worker) ----------
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/create') {
      if (await this.ctx.storage.get('room')) return json({ error: 'exists' }, 409);
      // the code is used to find this room in the registry, and the room learns it right here
      const code = (await req.text()).toUpperCase();
      if (!/^[A-Z]{4}$/.test(code)) return json({ error: 'bad code' }, 400);
      await this.ctx.storage.put('code', code);
      await this.ctx.storage.put('room', new BaseRoom(code, this.cfg.logic, this.plugins()).toJSON());
      await this.touch(true);
      await this.ctx.storage.setAlarm(Date.now() + idleMs(this.env) + 1000);
      this.report('game_created');
      return json({ ok: true });
    }
    if (url.pathname === '/close') { await this.closeIdle('admin'); return json({ ok: true }); }
    if (url.pathname === '/info') {
      const r = await this.load();
      return r ? json({ exists: true, started: r.started, players: r.players().length, maxPlayers: this.cfg.logic.maxPlayers }) : json({ exists: false }, 404);
    }
    if (url.pathname === '/ws') {
      const r = await this.load();
      if (!r) return json({ error: 'no such room' }, 404);
      if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      const pair = new WebSocketPair();
      const conn = crypto.randomUUID();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ conn } satisfies Attach);
      await this.touch();
      await this.schedule(r);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return json({ error: 'not found' }, 404);
  }

  // ---------- Nap Guard ----------
  /** True while the guard says the games are asleep: the room freezes and wakes with its timers pushed forward. */
  private async napping(ws?: WebSocket): Promise<boolean> {
    const nap = await getNap(this.env, Date.now(), (p) => this.ctx.waitUntil(p));
    if (this.napSince === undefined) this.napSince = (await this.ctx.storage.get<number>('napSince')) ?? null;
    if (nap.level === 'asleep') {
      if (!this.napSince) { this.napSince = Date.now(); await this.ctx.storage.put('napSince', this.napSince); }
      if (ws) { try { ws.send(JSON.stringify({ type: 'nap', resetAt: nap.resetAt } satisfies ServerMsg)); } catch { /* socket gone */ } }
      await this.ctx.storage.setAlarm(Math.max(nap.resetAt || Date.now() + 5 * 60_000, Date.now() + 1000) + 1000);
      return true;
    }
    const since = this.napSince;
    if (since) {
      this.napSince = null;
      await this.ctx.storage.delete('napSince');
      await this.touch(true);
      const room = await this.load();
      if (room) { room.shiftTime(Date.now() - since); await this.save(room); }
    }
    return false;
  }

  // ---------- websocket hibernation callbacks ----------
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (await this.napping(ws)) return;
    const room = await this.load();
    if (!room || typeof raw !== 'string' || raw.length > MAX_MESSAGE) return;
    let msg: ClientMsg;
    try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return;
    const att = (ws.deserializeAttachment() as Attach | null) ?? { conn: crypto.randomUUID() };
    if (msg.type === 'ping') { try { ws.send(JSON.stringify({ type: 'pong' } satisfies ServerMsg)); } catch { /* gone */ } return; }
    await this.touch();
    const before = { members: room.members.length, over: room.over };
    const err = room.handle(att.conn, msg);
    if (msg.type === 'hello' && !err) {
      att.member = room.memberIdOf(att.conn);
      ws.serializeAttachment(att);
      const last = room.members[room.members.length - 1];
      if (room.members.length > before.members && last && !last.screen) this.report('player_joined', { n: room.members.filter((m) => !m.bot && !m.screen).length });
    }
    if (!before.over && room.over) this.report('round_finished');
    if (err) {
      // a refused message changes nothing, so only the sender hears about it
      try { ws.send(JSON.stringify({ type: 'error', message: err } satisfies ServerMsg)); } catch { /* gone */ }
      return;
    }
    await this.save(room);
    this.broadcast(room);
  }

  async webSocketClose(ws: WebSocket) { await this.drop(ws); }
  async webSocketError(ws: WebSocket) { await this.drop(ws); }
  private async drop(ws: WebSocket) {
    const room = await this.load();
    const att = ws.deserializeAttachment() as Attach | null;
    if (!room || !att) return;
    room.disconnect(att.conn);
    await this.save(room); // a plugin may have started a grace timer
    this.broadcast(room);
  }

  async alarm() {
    if (await this.napping()) return;
    const room = await this.load();
    if (!room) return;
    if (Date.now() - (await this.lastActivity()) >= idleMs(this.env)) { await this.closeIdle(); return; }
    const was = room.over;
    if (room.tick(Date.now())) {
      if (!was && room.over) this.report('round_finished');
      await this.save(room); this.broadcast(room);
    } else await this.schedule(room);
  }
}
