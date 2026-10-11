// Plugin for BaseRoom, for REAL-TIME games (any seat may act at any moment, e.g. Sandwich Slam's Overstuffed).
//
//   plugins: () => [botsRealtime(logic, { plan })]
//
// Difference from @gizmo564/bots-away (turn-based): there, every automatic seat's timer restarts whenever the game state
// changes, which is right when only one seat can move. In a real-time game humans move constantly, so those timers would
// restart forever and the bots would never play. Here each automatic seat (a bot, or a human away past the grace period)
// keeps its OWN plan { action, at }; other players' moves do not touch it. A plan that is no longer legal when its time
// comes is refused by the game's `act`, dropped, and re-planned.
//
// The game supplies the brains:
//   plan(state, seatId, ctx, away) -> { action, afterMs } | null     null = nothing to do until the state changes
// The plugin supplies the timing, the stored plans (survive hibernation and the Nap Guard), the lobby 'bot' message,
// the away flag and host handoff (shared code with bots-away).
import type { BaseRoom, Member, RoomPlugin } from '@gizmo564/room-server/server/base-room';
import type { ActContext, GameLogic } from '@gizmo564/room-server/server/game-logic';
import type { ClientMsg } from '@gizmo564/room-server/server/protocol';
import { AWAY_GRACE_MS, MAX_BOTS_DEFAULT, flagAwayAndHandoff, handoffPossible, lobbyBotMessage } from '@gizmo564/bots-away/server/bots-away';

/** after a refused plan, wait this long before planning again (stops a hot loop on a stale plan) */
export const REPLAN_MS = 300;
/** a seat whose plans are refused this many times in a row sleeps until the state changes */
export const MAX_REFUSALS = 3;

/** do `action` after `afterMs`, or (recheckMs) do nothing yet and ask again later, e.g. a bot waiting for a better moment */
export type Planned<A> = { action: A; afterMs: number } | { recheckMs: number };
export interface BotsRealtimeOptions<S, A> {
  /** what this seat wants to do, and how long it "thinks" first. `away` is true for a disconnected human, false for a bot. */
  plan(state: S, seatId: string, ctx: ActContext, away: boolean): Planned<A> | null;
  awayGraceMs?: number;
  maxBots?: number;
  hostHandoff?: boolean;
}

interface SeatPlan<A> { action: A | null; at: number }
/** idle[id] = the eventSeq at which planning returned nothing; ask again only once the state has changed */
interface Store<A> { plans: Record<string, SeatPlan<A>>; idle: Record<string, number>; retryAt: Record<string, number>; fails: Record<string, number> }

export function botsRealtime<S, A, V>(logic: GameLogic<any, S, A, V, any>, opts: BotsRealtimeOptions<S, A>): RoomPlugin {
  const grace = opts.awayGraceMs ?? AWAY_GRACE_MS;
  const maxBots = opts.maxBots ?? MAX_BOTS_DEFAULT;
  const handoff = opts.hostHandoff ?? true;
  const fresh = (): Store<A> => ({ plans: {}, idle: {}, retryAt: {}, fails: {} });
  let st: Store<A> = fresh();

  const isAwayHuman = (m: Member) => !m.bot && !m.screen && m.role === 'player' && m.conns.size === 0;
  const auto = (m: Member, now: number) => m.role === 'player' && !m.screen && (m.bot || (isAwayHuman(m) && now - m.lastSeen >= grace));
  const ctxOf = (room: BaseRoom, now: number): ActContext => ({ now, seed: room.nextSeed(), hostId: room.host?.id ?? null, musicId: room.members.find((x) => x.music && !x.screen)?.id ?? null });

  /** ensure every automatic seat has a plan, or is idle until the state changes. Planning does not change the game. */
  function ensure(room: BaseRoom, now: number) {
    const live = new Set<string>();
    for (const m of room.members) {
      if (!auto(m, now)) { delete st.plans[m.id]; delete st.idle[m.id]; delete st.retryAt[m.id]; delete st.fails[m.id]; continue; }
      live.add(m.id);
      if (st.plans[m.id]) continue;
      if ((st.retryAt[m.id] ?? 0) > now) continue;
      if (st.idle[m.id] === room.eventSeq) continue;
      const p = opts.plan(room.game as S, m.id, ctxOf(room, now), !m.bot);
      if (!p) { st.idle[m.id] = room.eventSeq; continue; }
      delete st.idle[m.id];
      // a human who only just went away still gets a beat before the machine moves for them
      st.plans[m.id] = 'recheckMs' in p ? { action: null, at: now + Math.max(50, p.recheckMs) } : { action: p.action, at: now + Math.max(0, p.afterMs) };
    }
    for (const id of Object.keys(st.plans)) if (!live.has(id)) delete st.plans[id];
  }

  return {
    id: 'botsRealtime',
    save: () => st,
    load: (d) => {
      const x = d as Partial<Store<A>> | null;
      st = x && typeof x === 'object' ? { plans: { ...(x.plans ?? {}) }, idle: { ...(x.idle ?? {}) }, retryAt: { ...(x.retryAt ?? {}) }, fails: { ...(x.fails ?? {}) } } : fresh();
    },
    shift: (_room, ms) => {
      for (const p of Object.values(st.plans)) p.at += ms;
      for (const k of Object.keys(st.retryAt)) st.retryAt[k] += ms;
    },
    onStart: () => { st = fresh(); },
    onAgain: () => { st = fresh(); },
    onMessage: (room, me, msg: ClientMsg) => lobbyBotMessage(room, me, msg, logic, maxBots),

    tick(room, now) {
      const changed = flagAwayAndHandoff(room, now, grace, handoff);
      if (!room.started || room.over) return changed;
      ensure(room, now);
      // the seat whose plan is due earliest goes first; one automatic move per tick (events of a move are never merged)
      let best: string | null = null;
      for (const [id, p] of Object.entries(st.plans)) if (p.at <= now && (best === null || p.at < st.plans[best].at)) best = id;
      if (best === null) return changed;
      const p = st.plans[best];
      delete st.plans[best];
      if (p.action === null) return changed;   // a "look again later" slot: the next ensure() plans afresh, nothing to broadcast
      if (room.applyAct(best, p.action as never, now) !== null) {
        st.fails[best] = (st.fails[best] ?? 0) + 1;
        if (st.fails[best] >= MAX_REFUSALS) { st.idle[best] = room.eventSeq; delete st.fails[best]; } else st.retryAt[best] = now + REPLAN_MS;
        return changed;
      }
      delete st.fails[best];
      return true; // the state changed; the other seats keep their own plans
    },

    nextWake(room, now) {
      let at: number | null = null;
      const min = (t: number) => { if (Number.isFinite(t) && (at === null || t < at)) at = t; };
      for (const m of room.members) if (!m.bot && isAwayHuman(m) && !m.away) min(m.lastSeen + grace);
      const h = room.host;
      if (handoff && h && isAwayHuman(h) && (handoffPossible(room) || h.lastSeen + grace > now)) min(h.lastSeen + grace);
      if (room.started && !room.over) {
        ensure(room, now);
        for (const p of Object.values(st.plans)) min(p.at);
        for (const [id, t] of Object.entries(st.retryAt)) if (!st.plans[id] && t > now) min(t);
      }
      return at;
    },

    publicData: () => ({ graceMs: grace }),
  };
}
