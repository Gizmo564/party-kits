// Plugin for BaseRoom: bots, away-player takeover, and host handoff. Distilled from Sandwich Slam's online.ts
// (25 s grace, 1.4 s bot "thinking" pause, host moves to the next connected human).
//
//   plugins: () => [botsAway(myLogic)]
//
// The game supplies the brains in GameLogic:
//   botAct(state, seatId, ctx)   what a BOT seat does now, or null if it has nothing to do until something changes
//   awayAct(state, seatId, ctx)  what a disconnected HUMAN seat does (defaults to botAct), or null
// The plugin supplies the timing, the bookkeeping and the 'bot' message (host adds/removes bots in the lobby).
import type { BaseRoom, Member, RoomPlugin } from '@gizmo564/room-server/server/base-room';
import type { GameLogic } from '@gizmo564/room-server/server/game-logic';
import type { ClientMsg } from '@gizmo564/room-server/server/protocol';

export const AWAY_GRACE_MS = 25_000;
export const BOT_THINK_MS = 1_400;
/** a player who is away for the first time still gets this long to look like they are thinking */
const MIN_AWAY_DELAY_MS = 1_500;
export const MAX_BOTS_DEFAULT = 8;

export interface BotsAwayOptions {
  awayGraceMs?: number;
  botThinkMs?: number;
  maxBots?: number;
  /** move the host role to a connected human when the host has been gone for the grace period (default true) */
  hostHandoff?: boolean;
}

interface Plan { seq: number; nextAt: Record<string, number> }

export function botsAway<S, A, V>(logic: GameLogic<any, S, A, V, any>, opts: BotsAwayOptions = {}): RoomPlugin {
  const grace = opts.awayGraceMs ?? AWAY_GRACE_MS;
  const think = opts.botThinkMs ?? BOT_THINK_MS;
  const maxBots = opts.maxBots ?? MAX_BOTS_DEFAULT;
  const handoff = opts.hostHandoff ?? true;
  let plan: Plan = { seq: -1, nextAt: {} };

  const isAwayHuman = (m: Member) => !m.bot && !m.screen && m.role === 'player' && m.conns.size === 0;
  /** is this seat played by the machine right now? */
  const auto = (m: Member, now: number) => m.role === 'player' && !m.screen && (m.bot || (isAwayHuman(m) && now - m.lastSeen >= grace));

  /** when each automatic seat may act; reset whenever the game state changes so animations get time to play */
  function ensure(room: BaseRoom, now: number) {
    if (plan.seq !== room.eventSeq) plan = { seq: room.eventSeq, nextAt: {} };
    for (const m of room.members) {
      if (!auto(m, now) || plan.nextAt[m.id] !== undefined) continue;
      plan.nextAt[m.id] = m.bot ? now + think : Math.max(now + MIN_AWAY_DELAY_MS, m.lastSeen + grace);
    }
  }

  return {
    id: 'botsAway',
    save: () => plan,
    load: (d) => { const p = d as Plan; if (p && typeof p.seq === 'number' && p.nextAt) plan = { seq: p.seq, nextAt: { ...p.nextAt } }; },
    shift: (_room, ms) => { for (const k of Object.keys(plan.nextAt)) if (Number.isFinite(plan.nextAt[k])) plan.nextAt[k] += ms; },
    onStart: () => { plan = { seq: -1, nextAt: {} }; },
    onAgain: () => { plan = { seq: -1, nextAt: {} }; },

    onMessage(room, me, msg: ClientMsg) {
      if (msg.type !== 'bot') return undefined;
      if (!me.host) return 'only the host can change the bots';
      if (room.started) return 'bots can only be changed in the lobby';
      if (msg.op === 'add') {
        const bots = room.members.filter((m) => m.bot).length;
        if (bots >= maxBots) return `at most ${maxBots} bots`;
        if (room.players().length >= logic.maxPlayers) return `the room is full (${logic.maxPlayers} players)`;
        room.addMember({ name: `Bot ${bots + 1}`, bot: true, data: msg.level ? { level: String(msg.level).slice(0, 12) } : {} });
        return null;
      }
      if (msg.op === 'remove') {
        // no id: remove the newest bot
        const target = msg.id ? room.member(msg.id) : [...room.members].reverse().find((m) => m.bot);
        if (!target || !target.bot) return 'no such bot';
        room.removeMember(target.id);
        return null;
      }
      return 'unknown bot operation';
    },

    tick(room, now) {
      let changed = false;
      // away flag: shown to everyone so the table knows a bot is covering
      for (const m of room.members) {
        const away = !m.bot && isAwayHuman(m) && now - m.lastSeen >= grace;
        if (away !== m.away) { m.away = away; changed = true; }
      }
      // the host walked off: hand the room to someone who is here
      if (handoff) {
        const h = room.host;
        if (h && isAwayHuman(h) && now - h.lastSeen >= grace) {
          const next = room.members.filter((m) => !m.bot && !m.screen && m.conns.size > 0).sort((a, b) => a.lastSeen - b.lastSeen)[0];
          if (next && room.transferHost(next.id) === null) changed = true;
        }
      }
      if (!room.started || room.over) return changed;
      ensure(room, now);
      for (const m of room.members) {
        if (!auto(m, now)) continue;
        const at = plan.nextAt[m.id];
        if (at === undefined || at > now) continue;
        const ctx = { now, seed: room.nextSeed(), hostId: room.host?.id ?? null, musicId: room.members.find((x) => x.music && !x.screen)?.id ?? null };
        const action = m.bot ? logic.botAct?.(room.game as S, m.id, ctx) : (logic.awayAct ?? logic.botAct)?.(room.game as S, m.id, ctx);
        // nothing to do (or the move was refused): sleep this seat until the game state changes
        if (!action || room.applyAct(m.id, action as never, now) !== null) { plan.nextAt[m.id] = Infinity; continue; }
        return true; // one automatic move per tick; the state changed, so the plan resets
      }
      return changed;
    },

    nextWake(room, now) {
      let at: number | null = null;
      const min = (t: number) => { if (Number.isFinite(t) && (at === null || t < at)) at = t; };
      for (const m of room.members) {
        if (!m.bot && isAwayHuman(m) && !m.away) min(m.lastSeen + grace); // becomes away then
      }
      const h = room.host;
      if (handoff && h && isAwayHuman(h)) min(h.lastSeen + grace);
      if (room.started && !room.over) {
        ensure(room, now);
        for (const m of room.members) if (m.role === 'player' && !m.screen && (m.bot || m.away)) { const t = plan.nextAt[m.id]; if (t !== undefined) min(t); }
      }
      return at;
    },

    publicData: () => ({ graceMs: grace }),
  };
}
