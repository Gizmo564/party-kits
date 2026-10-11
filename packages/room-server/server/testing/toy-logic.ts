// A tiny game used ONLY by kit tests: first to `target` taps wins; a `timeLimitMs` setting adds a deadline.
// It exercises every part of GameLogic (settings, profile, start, act, masked view, timer, bot, away).
import { bad, clampInt, good, type Result, type Step } from '@gizmo564/engine-core/engine';
import type { GameLogic } from '../game-logic';

export interface ToySettings { target: number; timeLimitMs: number }
export interface ToyState { target: number; taps: Record<string, number>; secret: string; winner: string | null; endsAt: number | null; order: string[] }
export type ToyAction = { type: 'tap' } | { type: 'pass' };
export interface ToyView { target: number; taps: Record<string, number>; winner: string | null; secret: string | null; endsAt: number | null }
export type ToyEvent = { kind: 'tap'; id: string } | { kind: 'win'; id: string } | { kind: 'timeout' };

export const toyLogic: GameLogic<ToySettings, ToyState, ToyAction, ToyView, ToyEvent> = {
  id: 'toy', minPlayers: 2, maxPlayers: 4, avatarLooks: 6,
  defaultSettings: () => ({ target: 3, timeLimitMs: 0 }),
  cleanSettings(patch, cur) {
    if (typeof patch !== 'object' || patch === null) return 'bad settings';
    const p = patch as Partial<ToySettings>;
    return { target: clampInt(p.target, 1, 20, cur.target), timeLimitMs: clampInt(p.timeLimitMs, 0, 600_000, cur.timeLimitMs) };
  },
  cleanProfile(cur, patch) {
    const team = patch.team;
    if (team !== undefined && (typeof team !== 'number' || ![0, 1].includes(team))) return 'team must be 0 or 1';
    return { ...cur, ...(team !== undefined ? { team } : {}) };
  },
  start({ seats, settings, seed, now }): Result<ToyState> {
    const taps: Record<string, number> = {};
    for (const s of seats) taps[s.id] = 0;
    return good({ target: settings.target, taps, secret: `secret-${seed}`, winner: null, endsAt: settings.timeLimitMs ? now + settings.timeLimitMs : null, order: seats.map((s) => s.id) });
  },
  act(state, seat, action): Result<Step<ToyState, ToyEvent>> {
    if (!(seat in state.taps)) return bad('you are not in this game');
    if (state.winner) return bad('already over');
    if (action.type === 'pass') return good({ state, events: [] });
    const taps = { ...state.taps, [seat]: state.taps[seat] + 1 };
    const events: ToyEvent[] = [{ kind: 'tap', id: seat }];
    let winner: string | null = null;
    if (taps[seat] >= state.target) { winner = seat; events.push({ kind: 'win', id: seat }); }
    return good({ state: { ...state, taps, winner }, events });
  },
  view: (s, viewer) => ({ target: s.target, taps: s.taps, winner: s.winner, secret: viewer !== null && s.winner ? s.secret : null, endsAt: s.endsAt }),
  isOver: (s) => s.winner !== null,
  deadline: (s) => (s.winner ? null : s.endsAt),
  tick(s) {
    // time ran out: whoever has the most taps wins (first seat on a tie)
    const winner = [...s.order].sort((a, b) => s.taps[b] - s.taps[a])[0];
    return { state: { ...s, winner, endsAt: null }, events: [{ kind: 'timeout' }, { kind: 'win', id: winner }] };
  },
  shiftTime: (s, ms) => (s.endsAt === null ? s : { ...s, endsAt: s.endsAt + ms }),
  botAct: (s, id) => (s.taps[id] !== undefined && !s.winner ? { type: 'tap' } : null),
  awayAct: (s, id) => (s.taps[id] !== undefined && !s.winner ? { type: 'pass' } : null),
};
